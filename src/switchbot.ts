/// <reference types="./bluetooth.d.ts" />

const communicationService = 'cba20d00-224d-11e6-9fb8-0002a5d5c51b'
const sendCOmmandCharacteristic = 'cba20002-224d-11e6-9fb8-0002a5d5c51b'

window.onload = ()=>{
    console.log(navigator.bluetooth)
    const btnStart = document.getElementById("btnStart")
    if (!btnStart) return

    btnStart.onclick = async ()=> {
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
        const commands = await commServ?.getCharacteristic(sendCOmmandCharacteristic)
        if (!commands) return
        console.log("Attempting push")
        const pushData = Uint8Array.of(0x57/* magic */, 0x01 /* command */, 0x00/* push */)
        commands?.writeValue(pushData)
    }
}