export const BINDING_STORAGE_KEY='overclock-keybindings-v1';
export const ACTIONS=[['up','Move Up'],['down','Move Down'],['left','Move Left'],['right','Move Right'],['overclock','Overclock Bullet-Time'],['dash','Cyber Dash'],['emp','EMP Shockwave']];
export const DEFAULT_BINDINGS={up:'KeyW',down:'KeyS',left:'KeyA',right:'KeyD',overclock:'Space',dash:'Shift',emp:'KeyQ'};
export const PRESETS=[
 {id:'default',label:'WASD + SPACE (Default)',bindings:DEFAULT_BINDINGS},
 {id:'arrows',label:'ARROW KEYS + Z/X',bindings:{up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight',overclock:'KeyZ',dash:'KeyX',emp:'KeyC'}},
 {id:'left',label:'LEFT-HANDED',bindings:{up:'KeyI',down:'KeyK',left:'KeyJ',right:'KeyL',overclock:'Space',dash:'Control',emp:'KeyO'}},
];
export const normalizeKey=code=>/^(Shift|Control|Alt)(Left|Right)$/.test(code)?code.replace(/(Left|Right)$/,''):code;
export const supportedKey=code=>/^(Key[A-Z]|Digit[0-9]|Arrow(Up|Down|Left|Right)|Space|Shift|Control|Alt|Enter|Backspace|Delete|Home|End|PageUp|PageDown|Minus|Equal|BracketLeft|BracketRight|Backslash|Semicolon|Quote|Comma|Period|Slash|Backquote)$/.test(normalizeKey(code));
export function keyLabel(code){return ({Space:'SPACE',Shift:'SHIFT',Control:'CTRL',Alt:'ALT',ArrowUp:'↑',ArrowDown:'↓',ArrowLeft:'←',ArrowRight:'→'})[code]||code.replace(/^Key|^Digit/,'').replace(/([a-z])([A-Z])/g,'$1 $2').toUpperCase();}
export function validBindings(value){return !!value&&ACTIONS.every(([id])=>typeof value[id]==='string'&&supportedKey(value[id])&&normalizeKey(value[id])===value[id])&&new Set(ACTIONS.map(([id])=>value[id])).size===ACTIONS.length;}
export function loadBindings(storage=globalThis.localStorage){try{const saved=JSON.parse(storage.getItem(BINDING_STORAGE_KEY));if(validBindings(saved))return Object.fromEntries(ACTIONS.map(([id])=>[id,saved[id]]));}catch{}return {...DEFAULT_BINDINGS};}
export function saveBindings(bindings,storage=globalThis.localStorage){try{storage.setItem(BINDING_STORAGE_KEY,JSON.stringify(bindings));return true;}catch{return false;}}
export function bindKey(bindings,action,code){code=normalizeKey(code);if(!ACTIONS.some(([id])=>id===action)||!supportedKey(code))return {error:'KEY RESERVED / TRY ANOTHER'};const conflict=ACTIONS.find(([id])=>id!==action&&bindings[id]===code);if(conflict)return {error:`ALREADY BOUND: ${conflict[1].toUpperCase()}`};return {bindings:{...bindings,[action]:code}};}
// Preserve default arrow movement, except when an arrow is explicitly assigned.
export function actionKeys(bindings,action){const code=bindings[action];const arrows={up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight'};const alias=arrows[action];return alias&&code===DEFAULT_BINDINGS[action]&&!Object.values(bindings).includes(alias)?[code,alias]:[code];}
export function actionHeld(keys,bindings,action){return actionKeys(bindings,action).some(code=>keys.has(code));}
