import { connect, SwitchBot, TimerSetup, isTimerEnabled } from "./switchbot.ts"
import { el, div, span, input, option, label, select } from "../../xdom/src/xdom.ts"
import { calcSumTimes, toEndTime, hhMMfromTimeStr, hhMMToString } from "./utils.ts";

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
            span({innerText: timer.mode == "repeatForever" ? "forever" : `until ${hhMMToString(toEndTime(timer.startTime, timer.interval, timer.repeatSum))}`})
        ),
    )
}

async function editTimer(idx:number, timer:TimerSetup, timerDetails:HTMLElement, bot:SwitchBot) {
    // end time of repeating intervals
    const endTime = timer.repeatSum ? toEndTime(timer.startTime, timer.interval, timer.repeatSum) : 
                    { hours: timer.startTime.hours + 3, minutes:timer.startTime.minutes }
    // small viewModel reperesenting the state of the time edit
    const timerEdit = {
        enabled: isTimerEnabled(timer),
        repeat: timer.repeat,
        startTimeStr: toTimeStr(timer.startTime.hours, timer.startTime.minutes),
        repeatContinously: timer.mode!="daily",
        repeatInterval:toTimeStr(timer.interval.hours, timer.interval.minutes),
        repeatMode:timer.mode,
        endTimeStr: toTimeStr(endTime.hours, endTime.minutes),

        async apply() {
            console.log("Timer edit to save: ", timerEdit)
            timer.startTime = hhMMfromTimeStr( timerEdit.startTimeStr)
            if (timerEdit.enabled) {
                timer.repeatDays = undefined // this will use the defaults provided
                timer.repeat = timerEdit.repeat
            } else {
                timer.repeat = "daily"
                timer.repeatDays = 0
            }
            const intParts = timerEdit.repeatInterval.split(":")
            timer.interval.minutes = parseInt(intParts[1])
            timer.interval.hours = parseInt(intParts[0])
            timer.interval.seconds = 0
            // mode will be set to continous repeat, only when timer is enabled, otherwise bot will trigger...
            if (timerEdit.enabled && timerEdit.repeatContinously) {
                timer.mode = timerEdit.repeatMode  // repeatmode contains if this is a forever repeat or sumTimes mode timer  
                if (timerEdit.repeatMode == "repeatSumTimes") {
                    timer.repeatSum = calcSumTimes(timer.startTime, hhMMfromTimeStr(timerEdit.endTimeStr), timer.interval)
                }
            } else 
                timer.mode = "daily"
            
            
            console.log("Edited value: ", timer)
            await bot.setupTimer(timer)

            fillTimerDetails(timerDetails, timer, idx, bot)
        }
    }
    
    // shows an editor for the timer with absolute positioning
    const editDialog = div({ class:"dialog"},
        el("h3", {innerText: `Edit ${idx + 1}. timer`}),
        div({},
            input({ 
                id:"timerEnabled", 
                type: "checkbox", 
                checked: timerEdit.enabled, 
                onChange() { timerEdit.enabled = this.checked }
            }),
            label({ innerText: "Enabled", for:"timerEnabled"})
        ),
        div({},
            label({ innerText: "Start at", for:"startTime"}),
            input({ 
                id: "startTime", type:"time", 
                value:timerEdit.startTimeStr, 
                onInput() { timerEdit.startTimeStr = this.value }
            } ) 
        ),
        div({},
            label({ innerText: "Repeat", for:"repeat"}),
            select({ 
                    id:"repeat",
                    onChange() { timerEdit.repeat = this.value as "once"|"daily"  }
                }, 
                option({innerText:"Daily", selected:timer.repeat == "daily", value:"daily"}),
                option({innerText:"Once", selected:timer.repeat == "once", value:"once"}),
            ) 
        ),
        div({ visible: ()=> timerEdit.repeat == "daily" },
            input({ 
                id:"repeatContinously", type: "checkbox", 
                checked: timerEdit.repeatContinously, 
                onChange() { timerEdit.repeatContinously = this.checked}
            }),
            label({ innerText: "Repeat continously", for:"repeatContinously"})
        ),
        div({ visible: ()=> timerEdit.repeat == "daily" && timerEdit.repeatContinously },
            label({ innerText: "Repeat interval(hh:mm)", for:"interval"}),
            input({ 
                id: "interval", type:"text", 
                value:timerEdit.repeatInterval, 
                onInput() { timerEdit.repeatInterval = this.value }
            } ) ,
            div({},
                label({ innerText: "Repeat mode", for:"repeatMode"}),
                select({ 
                        id:"repeatMode",
                        onChange() { timerEdit.repeatMode = this.value as any  }
                    }, 
                    option({innerText:"Forever", selected:timer.mode == "repeatForever", value:"repeatForever"}),
                    option({innerText:"Until", selected:timer.mode == "repeatSumTimes", value:"repeatSumTimes"}),
                ),
                input({ 
                    visible: ()=> timerEdit.repeatMode == "repeatSumTimes",
                    type:"time", 
                    value:timerEdit.endTimeStr, 
                    onInput() { timerEdit.endTimeStr = this.value }
                } )
            )
        ),
        el("button", { innerText: "Save", async onClick(){
            // update timer setup, and timer display
            this.disabled = true
            await timerEdit.apply()
            editDialog.remove()
        }}),
        el("button", {innerText: "Cancel", onClick: ()=> editDialog.remove()})
    )

    document.body.append(editDialog)
}