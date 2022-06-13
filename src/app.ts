import { connectAndSendPush, connect, SwitchBot } from "./switchbot.ts"
import { el, div } from "../../xdom/src/xdom.ts"

let bot:SwitchBot|undefined

async function ensureConnected() {
    if (!bot)
        bot = await connect()
    return bot
}

window.onload = ()=>{
    console.log(navigator.bluetooth)
    const btnStart = document.getElementById("btnStart")
    if (!btnStart) return


    btnStart.onclick = async() => {
        await ensureConnected()
        if (!bot) return
        bot.push()
    } 
    document.body.append(
        el("button", {
            innerText: "Get device info",
            onClick: async ()=> {
                await ensureConnected()
                if (!bot) return
                await bot.getBasicInfo()
                await bot.getDeviceTime()
            }
        }),
        el("button", { 
            innerText: "Setup repeating timer", 
            onClick: async (ev) => {
                await ensureConnected()
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
        }),
        
    )
}