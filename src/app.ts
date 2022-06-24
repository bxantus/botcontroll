import { connectAndSendPush, connect, SwitchBot, TimerSetup, isTimerEnabled } from "./switchbot.ts"
import { el, div, span, input, option, label, select } from "../../xdom/src/xdom.ts"

// currently handling only one switchBot, this can be extended if needed
let switchBot:SwitchBot|undefined

window.onload = ()=>{
    console.log(navigator.bluetooth)
    startScreen() 
}

// Tasks
// =====
// - ability to add new timer (can reause the same edit dialog)

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
    const deviceTimeDiv = div({})

    botContainer.replaceChildren(
        el("h3", {innerText: ()=> botModel.name}),
        div( { id: "status"}, 
            span({class:"status",  innerText: ()=> `Battery: ${botModel.batteryInfo}`})
        ),
        div( {id:"time"},
            el("button", { innerText: "Get device time", onClick: ()=> refreshDeviceTime(botModel, deviceTimeDiv) }),
            deviceTimeDiv
        ),
        timersDiv
    )
    await botModel.refreshStatus()
    
    // query timers
    displayTimers(botModel, timersDiv)        
}

async function refreshDeviceTime(botModel:BotViewModel, el:HTMLElement) {
    await botModel.refreshDeviceTime()
    if (!botModel.deviceTime) {
        el.replaceChildren("Error getting device time")
    } else el.replaceChildren(
        span({  innerText: ()=> botModel.deviceTime!.device.toTimeString().substring(0, 8)}),
        span({innerText:" at "}),
        span( { innerText: ()=> botModel.deviceTime!.query.toTimeString().substring(0, 8)})
    )
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
    timersDiv.innerHTML = "Loading timers"
    await botModel.refreshTimers()

    if (botModel.numberOfTimers == 0) {
        timersDiv.replaceChildren("No timers active")
        return
    }
    timersDiv.replaceChildren()

    for (let i = 0; i < botModel.numberOfTimers; ++i) {
        const timer = botModel.timers[i]
        const timerDetails = div({ class:"timer"})
        fillTimerDetails(timerDetails, timer, i, botModel.bot)
        timersDiv.append(timerDetails)
    }
}

function fillTimerDetails(timerDetails:HTMLElement, timer:TimerSetup, idx:number, bot:SwitchBot) {
    const timerDisabled = !isTimerEnabled(timer)
    timerDetails.replaceChildren(
        el("h4", {innerText: `${idx+1}. timer ${timerDisabled ? "(disabled)": ""}`},
                el("button", { innerText: "Edit", onClick: ()=> editTimer(idx, timer, timerDetails, bot)})
            ),
            el("p",
                { innerText: `Start time: ${toTimeStr(timer.startTime.hours, timer.startTime.minutes)}` }
            ),
    )
    if (timerDisabled) return;
    timerDetails.append(
        el("p", { innerText: `Repeat: ${timer.repeat}`})
    )
    // no repeat interval set
    if (timer.mode == "daily") return;
    timerDetails.append(
        el("p", { innerText: `Repeat at interval: ${toTimeStr(timer.interval.hours, timer.interval.minutes)} `},
            span({innerText: timer.mode == "repeatForever" ? "forever" : `${timer.repeatSum} times`})
        ),
    )
}

async function editTimer(idx:number, timer:TimerSetup, timerDetails:HTMLElement, bot:SwitchBot) {
    // shows an editor with absolute positioning
    const chkTimerEnabled = input({ id:"timerEnabled", type: "checkbox", checked: isTimerEnabled(timer) as any}) 
    const inputStartTime = input({ id: "startTime", type:"time", value:`${toTimeStr(timer.startTime.hours, timer.startTime.minutes)}`} ) 
    const selctRepeat = select({ id:"repeat"}, 
        option({innerText:"Daily", selected:timer.repeat == "daily", value:"daily"}),
        option({innerText:"Once", selected:timer.repeat == "once", value:"once"}),
    ) 
    const chkRepeatCont = input({ id:"repeatContinously", type: "checkbox", checked: timer.mode!="daily"}) 
    const inpInterval = input({ id: "interval", type:"text", value:`${toTimeStr(timer.interval.hours, timer.interval.minutes)}`} ) 

    const editDialog = div({ class:"dialog"},
        el("h3", {innerText: `Edit ${idx + 1}. timer`}),
        div({},
            chkTimerEnabled,
            label({ innerText: "Enabled", for:"timerEnabled"})
        ),
        div({},
            label({ innerText: "Start at", for:"startTime"}),
            inputStartTime
        ),
        div({},
            label({ innerText: "Repeat", for:"repeat"}),
            selctRepeat
        ),
        div({},
            chkRepeatCont,
            label({ innerText: "Repeat continously", for:"repeatContinously"})
        ),
        div({},
            label({ innerText: "Repeat interval(hh:mm)", for:"interval"}),
            inpInterval
        ),
        el("button", { innerText: "Save", onClick: async ()=>{
            // update timer setup, and timer display
            timer.startTime.hours = parseInt( inputStartTime.value.substring(0, 2))
            timer.startTime.minutes = parseInt( inputStartTime.value.substring(3))
            if (chkTimerEnabled.checked) {
                timer.repeatDays = undefined // this will use the defaults provided
                timer.repeat = selctRepeat.value == "once" ? "once" : "daily"
            } else {
                timer.repeat = "daily"
                timer.repeatDays = 0
            }
            // mode will be set to continous repeat, only when timer is enabled, otherwise bot will trigger...
            if (chkRepeatCont.checked && chkTimerEnabled.checked) 
                timer.mode = "repeatForever"  
            else 
                timer.mode = "daily"
            
            const intParts = inpInterval.value.split(":")
            timer.interval.minutes = parseInt(intParts[1])
            timer.interval.hours = parseInt(intParts[0])
            timer.interval.seconds = 0
            console.log("Edited value: ", timer)
            await bot.setupTimer(timer)

            fillTimerDetails(timerDetails, timer, idx, bot)

            editDialog.remove()
        }}),
        el("button", {innerText: "Cancel", onClick: ()=> editDialog.remove()})
    )

    document.body.append(editDialog)
}