/// <reference types="./bluetooth.d.ts" />

// see: https://github.com/OpenWonderLabs/SwitchBotAPI-BLE/blob/latest/devicetypes/bot.md#ble-communication-data-message-basic-format
const communicationService = 'cba20d00-224d-11e6-9fb8-0002a5d5c51b'
const sendCommandCharacteristic = 'cba20002-224d-11e6-9fb8-0002a5d5c51b'
const commandResponseCharacteristic = 'cba20003-224d-11e6-9fb8-0002a5d5c51b'

export async function connectAndSendPush() {
    console.log("Requesting switchbot device")
    const device = await navigator.bluetooth.requestDevice({
        filters: [
            {services:[communicationService]}
        ]
    })
    console.log("Got device: ", device)
    const gatt = await device.gatt?.connect()
    console.log("Connected to GATT")
    const commServ = await gatt?.getPrimaryService(communicationService)
    const commands = await commServ?.getCharacteristic(sendCommandCharacteristic)
    if (!commands) return
    console.log("Attempting push")
    const pushData = Uint8Array.of(0x57/* magic */, 0x01 /* command */, 0x00/* push */)
    commands?.writeValue(pushData)
}

export async function connect() {
    console.log("Requesting switchbot device")
    const device = await navigator.bluetooth.requestDevice({
        filters: [
            {services:[communicationService]}
        ]
    })
    console.log("Got device: ", device)
    if (!device || !device.gatt) 
        return 
    const gatt = await device.gatt.connect()
    console.log("Connected to GATT")
    const commServ = await gatt.getPrimaryService(communicationService)
    const commands = await commServ.getCharacteristic(sendCommandCharacteristic)
    const results = await commServ.getCharacteristic(commandResponseCharacteristic)
    await results.startNotifications()
    return new SwitchBot({gatt, commands, results})
}

const StatusOk = 0x01
const StatusToMessage = {
    0x01: "OK Action executed",
    0x02: "ERROR Error while executing an Action" ,
    0x03: "BUSY Device is busy now, please try later", 
    0x04: "Communication protocol version incompatible" ,
    0x05: "Device does not support this Command",
    0x06: "Device low battery",
    0x07: "Device is encrypted",
    0x08: "Device is unencrypted",
    0x09: "Password error",
    0x0A: "Device does not support this encription method",
    0x0B: "Failed to locate a nearby mesh Device",
    0x0C: "Failed to connect to the network"
}

function statusMessage(status:number) {
    return (StatusToMessage as any)[status]
}

interface HhMM {
    hours:number
    minutes:number
}

interface HhMMSS {
    hours:number
    minutes:number
    seconds:number  
}

export interface TimerSetup {
    index:number  // timer index
    startTime:HhMM
    // repeat is on by default for all days (repeat: "daily" and repeatDays: 0x7f)
    repeat?:"once"|"daily"
    repeatDays?:number // bitmask [6:0] indicating days from  Sun to Mon
    // constinous mode: once daily, repeat forever at given intervalm repeat sum times
    mode:"daily"|"repeatForever"|"repeatSumTimes" 
    // press asumed as default
    action?:"press"|"on"|"off"
    repeatSum:number // number of times when repeatSum is seleceted
    interval:HhMMSS // seconds will be rounded to multiple of 10
}

export function isTimerEnabled(timer:TimerSetup) {
    // when no days are specified but the timer is in dayly repeat mode, it means it is disabled
    // NOTE: looks like switchbot app also manipulates the mode field to 0x80 for disabled timers
    return timer.repeat == "once" || timer.repeatDays
}

export class SwitchBot {
    gatt:BluetoothRemoteGATTServer
    commands:BluetoothRemoteGATTCharacteristic
    results:BluetoothRemoteGATTCharacteristic
    private responseResolver: (()=>void)|undefined

    constructor(setup:{gatt:BluetoothRemoteGATTServer, commands:BluetoothRemoteGATTCharacteristic, results:BluetoothRemoteGATTCharacteristic}) {
        this.gatt = setup.gatt
        this.commands = setup.commands
        this.results = setup.results
        this.results.oncharacteristicvaluechanged = event => {
            this.responseResolver?.()
        } 
    }

    async getBasicInfo() {
        console.log("Getting basic info")
        const command = Uint8Array.of(
            0x57/* magic */, 
            0x02 /* get info */
        )
        const resp = await this.executeCommand(command)
        const status = resp.getUint8(0)
        console.log("  Status: ", statusMessage(status))
        if (status != StatusOk) return

        const info = {
            batteryPercentage: resp.getUint8(1),
            firmwareVersion: resp.getUint8(2) * 0.1,
            numberOfTimers: resp.getUint8(8)
        }
        console.log(info)
        return info
    }

    async push() {
        console.log("Attempting push")
        const pushData = Uint8Array.of(0x57/* magic */, 0x01 /* command */, 0x00/* push */)
        
        const resp = await this.executeCommand(pushData)
        console.log("Response: ", resp)
        const status = resp.getUint8(0)
        console.log("  Status: ", statusMessage(status))       
    }

    async getDeviceTime() {
        console.log("Getting device time")
        const command = Uint8Array.of(
            0x57,
            0x08, // get time info
            0x01, // get current time
        )
        const resp = await this.executeCommand(command)
        const status = resp.getUint8(0)
        console.log("  Status: ", statusMessage(status))       
        const timestamp = resp.getBigUint64(1) // timestamp is in uxi time, and in seconds
        const timezoneOffset = new Date().getTimezoneOffset() * 60 * 1000 // in milliseconds
        const currTime = new Date(Number(timestamp)  * 1000 + timezoneOffset) // convert to local time zone
        console.log(currTime)
        return currTime
    }

    /**
     * NOTE: seconds part of the date will be ignored, only hh:mm is set in the device
     */
    async setDeviceTime(date:Date) {
        // convert given date to UTC timezone, as the device ignores timezones
        date = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000)
        console.log("Set device time: ", date.toUTCString())
        const command = Uint8Array.of(
            0x57,
            0x09, // set time info
            0x01, // set current time
            // 8 bytes reserved for timestamp
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
        )
        new DataView(command.buffer, command.byteOffset, command.byteLength)
            .setBigUint64(3, BigInt(Math.round(date.getTime() / 1000))) // set time in unix epoch, counted in seconds
        console.log("Command to set time:", command)
        const resp = await this.executeCommand(command)
        const status = resp.getUint8(0)
        console.log("  Status: ", statusMessage(status))       
    }

    /**
     * @param num number of timers between 0 and 5 inclusive
     */
    async setNumberOfTimers(num:number) {
        console.log("Setting number of active timers: ", num)
        const command = Uint8Array.of(
            0x57, // magic
            0x09, // time managament
            0x02, // set number of timers
            num
        )
        
        const resp = await this.executeCommand(command)
        const status = resp.getUint8(0)
        console.log("  Status: ", statusMessage(status))       
    }

    /**
     * 
     * @param timerIndex index of timer 0..4
     */
    async getTimerInfo(timerIndex:number) {
        console.log("Getting device time")
        const command = Uint8Array.of(
            0x57,
            0x08, // get time info
            0x03 + timerIndex * 0x10, // get current time
        )
        const resp = await this.executeCommand(command)
        const status = resp.getUint8(0)
        console.log("  Response:", resp)
        console.log("  Status: ", statusMessage(status))       
        if (status != StatusOk) 
            return
        const modes = ["daily", "repeatSumTimes", "repeatForever"]
        const actions = ["press", "on", "off"]
        const timerInfo:TimerSetup = {
            index: resp.getUint8(2),
            repeat: resp.getUint8(3) & 0x80 ? "once" : "daily",
            repeatDays: resp.getUint8(3) & 0x7f,
            startTime: { hours: resp.getUint8(4), minutes: resp.getUint8(5) },
            mode: modes[resp.getUint8(6)] as any,
            action: actions[resp.getUint8(7)] as any,
            repeatSum: resp.getUint8(8),
            interval: {
                hours: resp.getUint8(9),
                minutes: resp.getUint8(10),
                seconds: resp.getUint8(11) * 10, // seconds given in a multiple of 10
            }
        }
        return timerInfo     
    }

    async setupTimer(timer:TimerSetup) {
        console.log(`Setting up timer, starting from: ${timer.startTime.hours}:${timer.startTime.minutes}`)
        const mode = timer.mode == "repeatForever" ? 0x02 :
                        timer.mode == "repeatSumTimes" ? 0x01 : 0x00;
        const command = Uint8Array.of(
            0x57, // magic
            0x09, // time managament
            0x03, // setup timer task
            0x01, // number of tasks in payload
            timer.index,
            0x7F, // repeat mask: bit7: 0 when repeat daily, other bits days when timer will be active
            timer.startTime.hours,
            timer.startTime.minutes,
            mode,
            0x00,  // job: 0 means press
            timer.repeatSum,
            timer.interval.hours,
            timer.interval.minutes,
            timer.interval.seconds / 10 // multiple of 10 seconds needed here
        )
        const resp = await this.executeCommand(command)
        const status = resp.getUint8(0)
        console.log("  Status: ", statusMessage(status))       
    }

    private async executeCommand(command:BufferSource) {
        const response = new Promise<void>(resolve => this.responseResolver = resolve)       
        await this.commands.writeValue(command)
        await response
        this.responseResolver = undefined
        return this.results.value!
    }
}