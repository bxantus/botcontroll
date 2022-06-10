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

class SwitchBot {
    gatt:BluetoothRemoteGATTServer
    commands:BluetoothRemoteGATTCharacteristic
    results:BluetoothRemoteGATTCharacteristic
    private responseResolver: (()=>void)|undefined
    private response:Promise<void>|undefined

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
        await this.execute( ()=> this.commands.writeValue(pushData))
        const resp = this.results.value!
        console.log("Response: ", resp)
        const status = resp.getUint8(0)
        console.log("  Status: ", statusMessage(status))       
    }

    private async execute(task:()=>Promise<void>) {
        this.response = new Promise(resolve => this.responseResolver = resolve)       
        await task()
        return this.response
    }
}