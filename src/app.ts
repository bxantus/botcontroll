import { connectAndSendPush, connect, SwitchBot, TimerSetup, isTimerEnabled } from "./switchbot.ts"
import { el, div, span } from "../../xdom/src/xdom.ts"

// currently handling only one switchBot, this can be extended if needed
let switchBot:SwitchBot|undefined

window.onload = ()=>{
    console.log(navigator.bluetooth)
    startScreen() 
    // document.body.append(
    //     el("button", {
    //         innerText: "Get device info",
    //         onClick: async ()=> {
    //             await ensureConnected()
    //             if (!bot) return
    //             await bot.getBasicInfo()
    //             await bot.getDeviceTime()
    //         }
    //     }),
    //     el("button", { 
    //         innerText: "Setup repeating timer", 
    //         onClick: async (ev) => {
    //             await ensureConnected()
    //             if (!bot) return
    //             await bot.setNumberOfTimers(1)
    //             await bot.setupTimer({
    //                 index: 0,
    //                 startTime: { hours: 12, minutes: 53},
    //                 mode: "repeatForever",
    //                 repeatSum: 0,
    //                 interval: { hours: 0, minutes: 15, seconds:0 }
    //             })
    //         } 
    //     }),
    // )
}

// Tasks
// =====
// - ability to edit current timer config (overlay edit dialog), only accept changes when there are no errors
// - ability to add new timer (can reause the same edit dialog)
// - display bluetooth is not available, bluetooth not enabled status when bluetooth isn't ready
// - react to the canges in bluetooth availability and display connect button when ready

// Lower prio Tasks
// ================
// - we should keep in mind the free indexes of timers when new timers are to be added (when we delete a timer from the middle for example, index 1 will be available)

const botContainer = div({})

function startScreen() {
    document.body.append(
        el("h2", {innerText: "Bots"}),
        botContainer
    )

    botContainer.append(
        el("button", {
            innerText: "Connect to SwitchBot",
            onClick: async() =>{
                const bot = await connect()
                switchBot = bot
                if (bot) {
                    displaySwitchBot(bot)
                }
            }
        })
    )
}

class BotViewModel {
    batteryLevel?:number
    deviceTime?: {
        device:Date // time on device
        query:Date  // time of query
    }
    numberOfTimers = 0
    timers:TimerSetup[] = []

    constructor(public bot:SwitchBot) {

    }

    async refreshStatus() {
        const info = await this.bot.getBasicInfo()
        
        this.batteryLevel = info?.batteryPercentage
        this.numberOfTimers = info?.numberOfTimers ?? 0
    }

    async refreshDeviceTime() {
        const deviceTime = await this.bot.getDeviceTime()
        this.deviceTime = {
            device: deviceTime,
            query: new Date()
        }
    }

    get batteryInfo() {
        return this.batteryLevel ? `${this.batteryLevel}%` : 'n/a'
    }

    get name() {
        return "SwitchBot (unknown)"
    }

    async refreshTimers() {
        await this.refreshStatus()
        this.timers = []
        for (let idx = 0; idx < this.numberOfTimers; ++idx) {
            const info = await this.bot.getTimerInfo(idx)
            if (info)
                this.timers.push(info)
        }
    }
}

async function displaySwitchBot(bot:SwitchBot) {
    botContainer.replaceChildren(
        div({class:"connecting",  innerText: "Connecting"})
    )
    await bot.connect()
    const botModel = new BotViewModel(bot)
    
    const timersDiv = div({id:"timers"})

    botContainer.replaceChildren(
        el("h3", {innerText: ()=> botModel.name}),
        div( { id: "status"}, 
            span({class:"status",  innerText: ()=> `Battery: ${botModel.batteryInfo}`})
        ),
        div( {id:"time"},
            el("button", { innerText: "Get device time", onClick: ()=> botModel.refreshDeviceTime()}),
            div({  },
                span({  innerText: ()=> botModel.deviceTime?.device.toTimeString().substring(0, 8) ?? "n/a" }),
                span({innerText:" at "}),
                span( { innerText: ()=> botModel.deviceTime?.query.toTimeString().substring(0, 8) ?? ""})
            )
        ),
        timersDiv
    )
    await botModel.refreshStatus()
    
    // query timers
    displayTimers(botModel, timersDiv)        
}

function toTimeStr(hours:number, minutes:number, seconds?:number) {
    let res = `${hours}:`
    if (minutes < 10) res += "0"
    res += minutes
    if (seconds == undefined) 
        return res
    res += ":"
    if (seconds < 10) res += "0"
    res += seconds
    return res
}

async function displayTimers(botModel:BotViewModel, timersDiv:HTMLElement) {
    timersDiv.innerHTML = ""
    await botModel.refreshTimers()

    if (botModel.numberOfTimers == 0) {
        timersDiv.append("No timers active")
        return
    }

    for (let i = 0; i < botModel.numberOfTimers; ++i) {
        const timer = botModel.timers[i]
        const timerDisabled = !isTimerEnabled(timer)
        const timerDetails = div({ class:"timer"},
            el("h4", {innerText: `${i+1}. timer ${timerDisabled ? "(disabled)": ""}`}),
            el("p",
                { innerText: `Start time: ${toTimeStr(timer.startTime.hours, timer.startTime.minutes)}` }
            ),
        )
        timersDiv.append(timerDetails)
        if (timerDisabled) continue;
        timerDetails.append(
            el("p", { innerText: `Repeat: ${timer.repeat}`})
        )
        // no repeat interval set
        if (timer.mode == "daily") continue;
        timerDetails.append(
            el("p", { innerText: `Repeat at interval: ${toTimeStr(timer.interval.hours, timer.interval.minutes)} `},
                span({innerText: timer.mode == "repeatForever" ? "forever" : `${timer.repeatSum} times`})
            ),
        )
    }
}

// reperesentin ga timer edit operation
class TimerEdit {

}