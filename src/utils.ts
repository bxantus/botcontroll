import { HhMM, HhMMSS } from "./switchbot.ts";

function toTimeSpan(time:HhMM|HhMMSS) {
    return time.hours * 60 * 60 + time.minutes * 60 + ("seconds" in time ? time.seconds : 0)
}

export function toEndTime(startTime:HhMM, interval:HhMMSS, times:number):HhMM {
    const timeSpan = toTimeSpan(startTime) + times * toTimeSpan(interval)
    let hours = Math.floor(timeSpan/3600)
    let minutes = Math.floor((timeSpan % 3600) / 60)
    // don't allow to go over midnight
    if (hours >= 24) {
        hours = 23
        minutes = 59
    }
    return { hours, minutes }
}

export function calcSumTimes(startTime:HhMM, endTime:HhMM, interval:HhMMSS) {
    const start = toTimeSpan(startTime)
    const end = toTimeSpan(endTime)
    if (start > end) return 0
    const int = toTimeSpan(interval)
    return Math.floor((end - start) / int)
}

/**
 * @param timeStr Is a time string returned from a time type input (hh:mm) fromat
 */
export function hhMMfromTimeStr(timeStr:string):HhMM {
    return {
        hours : parseInt( timeStr.substring(0, 2)),
        minutes : parseInt( timeStr.substring(3))
    }
}

export function hhMMToString(time:HhMM) {
    let res = `${time.hours}:`
    if (time.minutes < 10) res += "0"
        res += time.minutes
    return res
} 