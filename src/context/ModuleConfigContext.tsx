import React, { createContext, useContext, useMemo, useState } from 'react';

export interface AppModuleDefinition { id:string; label:string; group:string; core?:boolean; }
export const APP_MODULES: AppModuleDefinition[] = [
 {id:'dashboard',label:'داشبورد',group:'پرورش',core:true},{id:'farmHalls',label:'سالن‌ها',group:'پرورش'},{id:'ponds',label:'استخرها',group:'پرورش',core:true},{id:'feeding',label:'تغذیه',group:'پرورش'},{id:'biometrics',label:'بیومتری',group:'پرورش'},{id:'waterQuality',label:'کیفیت آب',group:'پرورش'},{id:'mortality',label:'تلفات',group:'پرورش'},{id:'treatments',label:'درمان',group:'پرورش'},{id:'transfers',label:'انتقالات',group:'پرورش'},
 {id:'hatchery',label:'تکثیر',group:'تکثیر و تولید'},{id:'nursery',label:'نرسری',group:'تکثیر و تولید'},{id:'feedFactory',label:'کارخانه خوراک',group:'تکثیر و تولید'},{id:'warehouse',label:'انبار',group:'تکثیر و تولید'},{id:'laboratory',label:'آزمایشگاه',group:'تکثیر و تولید'},{id:'processing',label:'فرآوری',group:'تکثیر و تولید'},{id:'coldStorage',label:'سردخانه',group:'تکثیر و تولید'},
 {id:'crm',label:'CRM',group:'تجاری'},{id:'sales',label:'فروش',group:'تجاری'},{id:'accounting',label:'حسابداری',group:'تجاری'},{id:'hr',label:'منابع انسانی',group:'تجاری'},
 {id:'aiAssistant',label:'دستیار هوشمند',group:'سیستم'},{id:'mediaStudio',label:'رسانه و شبکه‌های اجتماعی',group:'سیستم'},{id:'maintenance',label:'نگهداری و تعمیرات',group:'سیستم'},{id:'reports',label:'گزارش‌ها',group:'سیستم'},{id:'securityAudit',label:'امنیت و کاربران',group:'سیستم',core:true},{id:'backup',label:'پشتیبان‌گیری',group:'سیستم',core:true},{id:'platformHub',label:'پلتفرم‌ها',group:'سیستم'},{id:'adminSettings',label:'تنظیمات ادمین',group:'سیستم',core:true},
];
const KEY='fathi_erp_enabled_modules_v1';
type Ctx={enabled:Record<string,boolean>;isEnabled:(id:string)=>boolean;setEnabled:(id:string,value:boolean)=>void;enableAll:()=>void;reset:()=>void};
const Context=createContext<Ctx|null>(null);
const defaults=()=>Object.fromEntries(APP_MODULES.map(m=>[m.id,true]));
export const ModuleConfigProvider:React.FC<{children:React.ReactNode}>=({children})=>{
 const [enabled,setState]=useState<Record<string,boolean>>(()=>{try{return {...defaults(),...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch{return defaults()}});
 const persist=(next:Record<string,boolean>)=>{setState(next);localStorage.setItem(KEY,JSON.stringify(next));};
 const value=useMemo<Ctx>(()=>({enabled,isEnabled:(id)=>enabled[id]!==false,setEnabled:(id,v)=>{const def=APP_MODULES.find(m=>m.id===id);if(def?.core&&!v)return;persist({...enabled,[id]:v});},enableAll:()=>persist(defaults()),reset:()=>persist(defaults())}),[enabled]);
 return <Context.Provider value={value}>{children}</Context.Provider>;
};
export const useModuleConfig=()=>{const c=useContext(Context);if(!c)throw new Error('ModuleConfigProvider missing');return c;};
