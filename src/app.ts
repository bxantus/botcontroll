import { connectAndSendPush } from "./switchbot.ts"

window.onload = ()=>{
    console.log(navigator.bluetooth)
    const btnStart = document.getElementById("btnStart")
    if (!btnStart) return

    btnStart.onclick = connectAndSendPush
}