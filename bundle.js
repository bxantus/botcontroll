// deno:file:///C:/work/botcontroll/src/switchbot.ts
var communicationService = "cba20d00-224d-11e6-9fb8-0002a5d5c51b";
var sendCommandCharacteristic = "cba20002-224d-11e6-9fb8-0002a5d5c51b";
var commandResponseCharacteristic = "cba20003-224d-11e6-9fb8-0002a5d5c51b";
async function connect() {
  console.log("Requesting switchbot device");
  const device = await navigator.bluetooth.requestDevice({
    filters: [
      { services: [communicationService] }
    ]
  });
  console.log("Got device: ", device);
  if (!device || !device.gatt)
    return;
  return new SwitchBot(device.gatt);
}
var StatusOk = 1;
var StatusToMessage = {
  1: "OK Action executed",
  2: "ERROR Error while executing an Action",
  3: "BUSY Device is busy now, please try later",
  4: "Communication protocol version incompatible",
  5: "Device does not support this Command",
  6: "Device low battery",
  7: "Device is encrypted",
  8: "Device is unencrypted",
  9: "Password error",
  10: "Device does not support this encription method",
  11: "Failed to locate a nearby mesh Device",
  12: "Failed to connect to the network"
};
function statusMessage(status) {
  return StatusToMessage[status];
}
function isTimerEnabled(timer) {
  return timer.repeat == "once" || timer.repeatDays !== 0;
}
var SwitchBot = class {
  constructor(gatt) {
    this.gatt = gatt;
  }
  async connect() {
    if (this.gatt.connected)
      return;
    console.log("Connecting to GATT...");
    const gatt = await this.gatt.connect();
    console.log("Connected to GATT");
    const commServ = await gatt.getPrimaryService(communicationService);
    this.commands = await commServ.getCharacteristic(sendCommandCharacteristic);
    this.results = await commServ.getCharacteristic(commandResponseCharacteristic);
    await this.results.startNotifications();
    this.results.oncharacteristicvaluechanged = (event) => {
      this.responseResolver?.();
    };
  }
  async getBasicInfo() {
    await this.connect();
    console.log("Getting basic info");
    const command = Uint8Array.of(87, 2);
    const resp = await this.executeCommand(command);
    const status = resp.getUint8(0);
    console.log("  Status: ", statusMessage(status));
    if (status != StatusOk)
      return;
    const info = {
      batteryPercentage: resp.getUint8(1),
      firmwareVersion: resp.getUint8(2) * 0.1,
      numberOfTimers: resp.getUint8(8)
    };
    console.log(info);
    return info;
  }
  async push() {
    await this.connect();
    console.log("Attempting push");
    const pushData = Uint8Array.of(87, 1, 0);
    const resp = await this.executeCommand(pushData);
    console.log("Response: ", resp);
    const status = resp.getUint8(0);
    console.log("  Status: ", statusMessage(status));
  }
  async getDeviceTime() {
    await this.connect();
    console.log("Getting device time");
    const command = Uint8Array.of(87, 8, 1);
    const resp = await this.executeCommand(command);
    const status = resp.getUint8(0);
    console.log("  Status: ", statusMessage(status));
    const timestamp = resp.getBigUint64(1);
    const timezoneOffset = new Date().getTimezoneOffset() * 60 * 1e3;
    const currTime = new Date(Number(timestamp) * 1e3 + timezoneOffset);
    console.log(currTime);
    return currTime;
  }
  async setDeviceTime(date) {
    await this.connect();
    date = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1e3);
    console.log("Set device time: ", date.toUTCString());
    const command = Uint8Array.of(87, 9, 1, 0, 0, 0, 0, 0, 0, 0, 0);
    new DataView(command.buffer, command.byteOffset, command.byteLength).setBigUint64(3, BigInt(Math.round(date.getTime() / 1e3)));
    console.log("Command to set time:", command);
    const resp = await this.executeCommand(command);
    const status = resp.getUint8(0);
    console.log("  Status: ", statusMessage(status));
  }
  async setNumberOfTimers(num) {
    await this.connect();
    console.log("Setting number of active timers: ", num);
    const command = Uint8Array.of(87, 9, 2, num);
    const resp = await this.executeCommand(command);
    const status = resp.getUint8(0);
    console.log("  Status: ", statusMessage(status));
  }
  async getTimerInfo(timerIndex) {
    await this.connect();
    console.log("Getting device time");
    const command = Uint8Array.of(87, 8, 3 + timerIndex * 16);
    const resp = await this.executeCommand(command);
    const status = resp.getUint8(0);
    console.log("  Response:", resp);
    console.log("  Status: ", statusMessage(status));
    if (status != StatusOk)
      return;
    const modes = ["daily", "repeatSumTimes", "repeatForever"];
    const actions = ["press", "on", "off"];
    const timerInfo = {
      index: resp.getUint8(2),
      repeat: resp.getUint8(3) & 128 ? "once" : "daily",
      repeatDays: resp.getUint8(3) & 127,
      startTime: { hours: resp.getUint8(4), minutes: resp.getUint8(5) },
      mode: modes[resp.getUint8(6)],
      action: actions[resp.getUint8(7)],
      repeatSum: resp.getUint8(8),
      interval: {
        hours: resp.getUint8(9),
        minutes: resp.getUint8(10),
        seconds: resp.getUint8(11) * 10
      }
    };
    return timerInfo;
  }
  async setupTimer(timer) {
    await this.connect();
    console.log(`Setting up timer, starting from: ${timer.startTime.hours}:${timer.startTime.minutes}`);
    const mode = timer.mode == "repeatForever" ? 2 : timer.mode == "repeatSumTimes" ? 1 : 0;
    let repeatMask = 0;
    if (timer.repeat == "once")
      repeatMask = 128;
    else {
      repeatMask = timer.repeatDays ?? 127;
    }
    const command = Uint8Array.of(87, 9, 3, 1, timer.index, repeatMask, timer.startTime.hours, timer.startTime.minutes, mode, 0, timer.repeatSum, timer.interval.hours, timer.interval.minutes, timer.interval.seconds / 10);
    const resp = await this.executeCommand(command);
    const status = resp.getUint8(0);
    console.log("  Status: ", statusMessage(status));
  }
  async executeCommand(command) {
    const response = new Promise((resolve) => this.responseResolver = resolve);
    await this.commands.writeValue(command);
    await response;
    this.responseResolver = void 0;
    return this.results.value;
  }
};

// deno:file:///C:/work/xdom/src/dispose.ts
function dispose(...objects) {
  for (const obj of objects) {
    if (obj instanceof Array) {
      for (const o of obj)
        o.dispose();
      obj.splice(0);
    } else
      obj.dispose();
  }
}

// deno:file:///C:/work/xdom/src/binding/subscriptions.ts
var any = Symbol("AnyProperty");

// deno:file:///C:/work/xdom/src/binding/observableObject.ts
var ObservableTraps = class {
  get(target, p, receiver) {
    return target[p];
  }
  set(target, p, value, receiver) {
    const old = target[p];
    if (old != value) {
      target[p] = value;
      target.__subs.notifyFor(p, value);
    }
    return true;
  }
};
var observableTraps = new ObservableTraps();

// deno:file:///C:/work/xdom/src/binding/binding.ts
var Binding = class {
  constructor(vf, ...observables) {
    this.subs = [];
    this.valueFunction = vf;
    this.observe(...observables);
  }
  refresh() {
    const newVal = this.valueFunction();
    this.update?.(newVal);
  }
  compute() {
    return this.valueFunction();
  }
  onUpdate(updateFunction) {
    this.update = updateFunction;
    if (this.update)
      this.refresh();
  }
  bindTo(target, prop) {
    this.onUpdate((v) => target[prop] = v);
  }
  observe(...observables) {
    const onChange = () => this.refresh();
    for (const obs of observables) {
      if (!obs)
        continue;
      this.subs.push(obs.subscribe(onChange));
    }
  }
  dispose() {
    dispose(this.subs);
  }
};
function bind(target, prop, v, repo) {
  if (v === void 0)
    return;
  if (v instanceof Binding) {
    v.bindTo(target, prop);
    repo?.add(target, v);
    return v;
  } else
    target[prop] = v;
}
var BindingRepository = class {
  constructor() {
    this.bindings = /* @__PURE__ */ new Map();
  }
  add(obj, binding) {
    if (!binding)
      return;
    const list = this.bindings.get(obj);
    if (!list) {
      this.bindings.set(obj, [binding]);
    } else
      list.push(binding);
  }
  clearBindings(obj) {
    const list = this.bindings.get(obj);
    if (!list)
      return;
    for (const b of list)
      b.dispose();
    this.bindings.delete(obj);
  }
};

// deno:file:///C:/work/xdom/src/binding/lightBinding.ts
var Repository = class {
  constructor() {
    this.bindings = /* @__PURE__ */ new Map();
  }
  add(obj, prop, calc) {
    if (!calc)
      return;
    const list = this.bindings.get(obj);
    const binding = { prop, calc };
    if (!list) {
      this.bindings.set(obj, [binding]);
    } else
      list.push(binding);
  }
  clearForObject(obj) {
    this.bindings.delete(obj);
  }
  has(obj) {
    return this.bindings.has(obj);
  }
  refresh(obj) {
    const list = this.bindings.get(obj);
    if (!list)
      return;
    for (const lb of list) {
      const newVal = lb.calc();
      if (obj[lb.prop] != newVal)
        obj[lb.prop] = newVal;
    }
  }
};
function calcProperty(obj, prop, calc, repo) {
  obj[prop] = calc();
  repo?.add(obj, prop, calc);
}

// deno:file:///C:/work/xdom/src/domChanges.ts
var lightBindings = new Repository();
function refreshProps() {
  for (const obj of lightBindings.bindings.keys()) {
    lightBindings.refresh(obj);
  }
}
function refresh(time) {
  requestAnimationFrame(refresh);
  updateStats(time);
  const numUpdates = updates.length;
  for (let i = 0; i < numUpdates; ++i) {
    updates[i]();
  }
  updates.splice(0, numUpdates);
  recurringState.running = true;
  for (const r of recurring) {
    if (r.enabled)
      r.update();
  }
  recurringState.running = false;
  if (recurringState.dirty) {
    recurring = recurring.filter((r) => r.enabled);
    recurringState.dirty = false;
  }
  refreshProps();
}
var updates = [];
var recurringState = {
  running: false,
  dirty: false
};
var recurring = [];
var refreshHandle = void 0;
function startObservingChanges() {
  if (refreshHandle == void 0)
    refreshHandle = requestAnimationFrame(refresh);
}
var bindingRepo = new BindingRepository();
var stats = {
  numBoundObjects: bindingRepo.bindings.size,
  numLightBoundObjects: lightBindings.bindings.size,
  numRecurringUpdates: recurring.length,
  fps: 60
};
var fpsWindowStart = void 0;
var framesInWindow = 0;
var fpsWindowSize = 200;
function updateStats(timestamp) {
  stats.numBoundObjects = bindingRepo.bindings.size;
  stats.numLightBoundObjects = lightBindings.bindings.size;
  stats.numRecurringUpdates = recurring.length;
  if (fpsWindowStart === void 0) {
    fpsWindowStart = timestamp;
  } else {
    const fpsWindow = timestamp - fpsWindowStart;
    framesInWindow++;
    if (fpsWindow >= fpsWindowSize) {
      stats.fps = Math.round(framesInWindow * 1e3 / fpsWindow);
      framesInWindow = 0;
      fpsWindowStart = timestamp;
    }
  }
}

// deno:file:///C:/work/xdom/src/xdom.ts
function el(tagname, props, ...children) {
  const element = document.createElement(tagname);
  if (props?.id)
    element.id = props.id;
  if (props?.class)
    setProperty(element, "className", props.class);
  if (props?.innerText)
    setProperty(element, "innerText", props.innerText);
  if (props?.onClick)
    element.onclick = props.onClick;
  if (props?.src && element instanceof HTMLImageElement)
    setProperty(element, "src", props.src);
  if (element instanceof HTMLInputElement) {
    if (props?.type)
      element.type = props.type;
    if (props?.checked != void 0)
      setProperty(element, "checked", props.checked);
  }
  if (props?.for && element instanceof HTMLLabelElement) {
    element.htmlFor = props.for;
  }
  if (props?.value && (element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLOptionElement))
    setProperty(element, "value", props.value);
  if (props?.selected && element instanceof HTMLOptionElement) {
    setProperty(element, "selected", props.selected);
  }
  if (children)
    element.append(...children);
  return element;
}
function div(props, ...children) {
  return el("div", props, ...children);
}
function span(props, ...children) {
  return el("span", props, ...children);
}
function setProperty(obj, prop, val) {
  if (val instanceof Function)
    calcProperty(obj, prop, val, lightBindings);
  else
    bind(obj, prop, val, bindingRepo);
}
startObservingChanges();

// deno:file:///C:/work/botcontroll/src/app.ts
var switchBot;
window.onload = () => {
  console.log(navigator.bluetooth);
  startScreen();
};
var botContainer = div({});
function startScreen() {
  document.body.append(el("h2", { innerText: "Bots" }), botContainer);
  botContainer.append(el("button", {
    innerText: "Connect to SwitchBot",
    onClick: async () => {
      const bot = await connect();
      switchBot = bot;
      if (bot) {
        displaySwitchBot(bot);
      }
    }
  }));
}
var BotViewModel = class {
  constructor(bot) {
    this.bot = bot;
    this.numberOfTimers = 0;
    this.timers = [];
  }
  async refreshStatus() {
    const info = await this.bot.getBasicInfo();
    this.batteryLevel = info?.batteryPercentage;
    this.numberOfTimers = info?.numberOfTimers ?? 0;
  }
  async refreshDeviceTime() {
    const deviceTime = await this.bot.getDeviceTime();
    this.deviceTime = {
      device: deviceTime,
      query: new Date()
    };
  }
  get batteryInfo() {
    return this.batteryLevel ? `${this.batteryLevel}%` : "n/a";
  }
  get name() {
    return "SwitchBot (unknown)";
  }
  async refreshTimers() {
    await this.refreshStatus();
    this.timers = [];
    for (let idx = 0; idx < this.numberOfTimers; ++idx) {
      const info = await this.bot.getTimerInfo(idx);
      if (info)
        this.timers.push(info);
    }
  }
};
async function displaySwitchBot(bot) {
  botContainer.replaceChildren(div({ class: "connecting", innerText: "Connecting" }));
  await bot.connect();
  const botModel = new BotViewModel(bot);
  const timersDiv = div({ id: "timers" });
  const deviceTimeDiv = div({});
  botContainer.replaceChildren(el("h3", { innerText: () => botModel.name }), div({ id: "status" }, span({ class: "status", innerText: () => `Battery: ${botModel.batteryInfo}` })), div({ id: "time" }, el("button", { innerText: "Get device time", onClick: () => refreshDeviceTime(botModel, deviceTimeDiv) }), deviceTimeDiv), timersDiv);
  await botModel.refreshStatus();
  displayTimers(botModel, timersDiv);
}
async function refreshDeviceTime(botModel, el2) {
  await botModel.refreshDeviceTime();
  if (!botModel.deviceTime) {
    el2.replaceChildren("Error getting device time");
  } else
    el2.replaceChildren(span({ innerText: () => botModel.deviceTime.device.toTimeString().substring(0, 8) }), span({ innerText: " at " }), span({ innerText: () => botModel.deviceTime.query.toTimeString().substring(0, 8) }));
}
function toTimeStr(hours, minutes, seconds) {
  let res = `${hours}:`;
  if (minutes < 10)
    res += "0";
  res += minutes;
  if (seconds == void 0)
    return res;
  res += ":";
  if (seconds < 10)
    res += "0";
  res += seconds;
  return res;
}
async function displayTimers(botModel, timersDiv) {
  timersDiv.innerHTML = "Loading timers";
  await botModel.refreshTimers();
  if (botModel.numberOfTimers == 0) {
    timersDiv.replaceChildren("No timers active");
    return;
  }
  timersDiv.replaceChildren();
  for (let i = 0; i < botModel.numberOfTimers; ++i) {
    const timer = botModel.timers[i];
    const timerDetails = div({ class: "timer" });
    fillTimerDetails(timerDetails, timer, i, botModel.bot);
    timersDiv.append(timerDetails);
  }
}
function fillTimerDetails(timerDetails, timer, idx, bot) {
  const timerDisabled = !isTimerEnabled(timer);
  timerDetails.replaceChildren(el("h4", { innerText: `${idx + 1}. timer ${timerDisabled ? "(disabled)" : ""}` }, el("button", { innerText: "Edit", onClick: () => editTimer(idx, timer, timerDetails, bot) })), el("p", { innerText: `Start time: ${toTimeStr(timer.startTime.hours, timer.startTime.minutes)}` }));
  if (timerDisabled)
    return;
  timerDetails.append(el("p", { innerText: `Repeat: ${timer.repeat}` }));
  if (timer.mode == "daily")
    return;
  timerDetails.append(el("p", { innerText: `Repeat at interval: ${toTimeStr(timer.interval.hours, timer.interval.minutes)} ` }, span({ innerText: timer.mode == "repeatForever" ? "forever" : `${timer.repeatSum} times` })));
}
async function editTimer(idx, timer, timerDetails, bot) {
  const chkTimerEnabled = el("input", { id: "timerEnabled", type: "checkbox", checked: isTimerEnabled(timer) });
  const inputStartTime = el("input", { id: "startTime", type: "time", value: `${toTimeStr(timer.startTime.hours, timer.startTime.minutes)}` });
  const selctRepeat = el("select", { id: "repeat" }, el("option", { innerText: "Daily", selected: timer.repeat == "daily", value: "daily" }), el("option", { innerText: "Once", selected: timer.repeat == "once", value: "once" }));
  const chkRepeatCont = el("input", { id: "repeatContinously", type: "checkbox", checked: timer.mode != "daily" });
  const inpInterval = el("input", { id: "interval", type: "text", value: `${toTimeStr(timer.interval.hours, timer.interval.minutes)}` });
  const editDialog = div({ class: "dialog" }, el("h3", { innerText: `Edit ${idx + 1}. timer` }), div({}, chkTimerEnabled, el("label", { innerText: "Enabled", for: "timerEnabled" })), div({}, el("label", { innerText: "Start at", for: "startTime" }), inputStartTime), div({}, el("label", { innerText: "Repeat", for: "repeat" }), selctRepeat), div({}, chkRepeatCont, el("label", { innerText: "Repeat continously", for: "repeatContinously" })), div({}, el("label", { innerText: "Repeat interval(hh:mm)", for: "interval" }), inpInterval), el("button", { innerText: "Save", onClick: async () => {
    timer.startTime.hours = parseInt(inputStartTime.value.substring(0, 2));
    timer.startTime.minutes = parseInt(inputStartTime.value.substring(3));
    if (chkTimerEnabled.checked) {
      timer.repeatDays = void 0;
      timer.repeat = selctRepeat.value == "once" ? "once" : "daily";
    } else {
      timer.repeat = "daily";
      timer.repeatDays = 0;
    }
    if (chkRepeatCont.checked && chkTimerEnabled.checked)
      timer.mode = "repeatForever";
    else
      timer.mode = "daily";
    const intParts = inpInterval.value.split(":");
    timer.interval.minutes = parseInt(intParts[1]);
    timer.interval.hours = parseInt(intParts[0]);
    timer.interval.seconds = 0;
    console.log("Edited value: ", timer);
    await bot.setupTimer(timer);
    fillTimerDetails(timerDetails, timer, idx, bot);
    editDialog.remove();
  } }), el("button", { innerText: "Cancel", onClick: () => editDialog.remove() }));
  document.body.append(editDialog);
}
//# sourceMappingURL=bundle.js.map
