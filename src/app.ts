import { connectAndSendPush, connect } from "./switchbot.ts"
import { el, div } from "../../xdom/src/xdom.ts"

window.onload = ()=>{
    console.log(navigator.bluetooth)
    const btnStart = document.getElementById("btnStart")
    if (!btnStart) return

    btnStart.onclick = async() => {
        const bot = await connect()
        if (!bot) return
        bot.push()
    } 
}