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

interface TimerSetup {
    index:number  // timer index
    startTime:HhMM
    // todo: repeat, currently will repeat for each day
    // repeat:once, daily etc.
    mode:"daily"|"repeatForever"|"repeatSumTimes" 
    // todo: action, currently wil be always press
    repeatSum:number // number of times when repeatSum is seleceted
    interval:HhMMSS // seconds will be rounded to multiple of 10
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

    async push() {
        console.log("Attempting push")
        const pushData = Uint8Array.of(0x57/* magic */, 0x01 /* command */, 0x00/* push */)
        
        const resp = await this.executeCommand(pushData)
        console.log("Response: ", resp)
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