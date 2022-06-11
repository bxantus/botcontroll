import { connectAndSendPush, connect, SwitchBot } from "./switchbot.ts"
import { el, div } from "../../xdom/src/xdom.ts"

window.onload = ()=>{
    console.log(navigator.bluetooth)
    const btnStart = document.getElementById("btnStart")
    if (!btnStart) return

    let bot:SwitchBot|undefined

    btnStart.onclick = async() => {
        if (!bot)
            bot = await connect()
        if (!bot) return
        bot.push()
    } 
    document.body.append(
        el("button", { 
            innerText: "Setup repeating timer", 
            onClick: async (ev) => {
                if (!bot)
                bot = await connect()
                if (!bot) return
                await bot.setNumberOfTimers(1)
                await bot.setupTimer({
                    index: 0,
                    startTime: { hours: 12, minutes: 53},
                    mode: "repeatForever",
                    repeatSum: 0,
                    interval: { hours: 0, minutes: 15, seconds:0 }
                })
            } 
        })
    )
}