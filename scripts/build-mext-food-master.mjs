import * as XLSX from "xlsx";
import {writeFile,mkdir} from "node:fs/promises";

const SOURCE="https://www.mext.go.jp/content/20260327-mxt_kagsei-mext-000029402_02.xlsx";
const res=await fetch(SOURCE);
if(!res.ok)throw new Error("MEXT download failed: "+res.status);
const book=XLSX.read(await res.arrayBuffer(),{type:"array"});
const rows=XLSX.utils.sheet_to_json(book.Sheets["表全体"],{header:1,raw:true,defval:null});
const ids=rows[11];
const col=x=>ids.indexOf(x);
const I={k:col("ENERC_KCAL"),p:col("PROT-"),f:col("FAT-"),c:col("CHOCDF-"),fi:col("FIB-"),s:col("NACL_EQ")};
const n=v=>{if(typeof v==="number")return v;if(v==null)return null;let x=String(v).trim().replace(/[()]/g,"");if(x==="Tr")return 0;if(["-","—","*",""].includes(x))return null;let z=Number(x);return Number.isFinite(z)?z:null};
const foods=rows.slice(12).filter(r=>r[1]&&r[3]).map(r=>[String(r[1]),String(r[3]).replace(/　/g," ").trim(),n(r[I.k]),n(r[I.p]),n(r[I.f]),n(r[I.c]),n(r[I.fi]),n(r[I.s])]);
await mkdir("data",{recursive:true});
await writeFile("data/mext-food-master.js",`// Generated from MEXT 2026-03-27 official workbook. Do not edit manually.\nexport default ${JSON.stringify(foods)};\n`);
console.log("Generated MEXT food master:",foods.length,"foods");
