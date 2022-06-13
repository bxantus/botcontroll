import { connectAndSendPush, connect, SwitchBot } from "./switchbot.ts"
import { el, div, span } from "../../xdom/src/xdom.ts"

// currently handling only one switchBot, this can be extended if needed
let bot:SwitchBot|undefined

async function ensureConnected() {
    if (!bot)
        bot = await connect()
    return bot
}

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
// - display connect to switchbot prompt at start, after connected we can display the bot if we have a matching persisted id for them
// - after bot is connected display basic info (status) (battery level, current time of device compared to our time)
// - display current active timer tasks (when is a task considered to be set up?)
//         a task is considered to be usable, if the repeat field is set to some other value than 0 (no execution basically)
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
            innerText: "Connect to SitchBot",
            onClick: async() =>{
                const bot = await ensureConnected()
                if (bot) {
                    botContainer.innerHTML = "" // clear old controls
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

    constructor(public bot:SwitchBot) {

    }

    async refreshStatus() {
        const info = await this.bot.getBasicInfo()
        
        this.batteryLevel = info?.batteryPercentage
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
}

function displaySwitchBot(bot:SwitchBot) {
    const botModel = new BotViewModel(bot)
    botModel.refreshStatus()

    botContainer.append(
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
        div({id:"timers"},
                           
        )
    )

}