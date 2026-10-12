'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const create = require('../src/relay-i18n.js');
const schema = require('../src/save-schema.js');
const root = path.resolve(__dirname, '..');
function catalogs() {
  const dictionaries = { en: {}, fr: {} };
  const locale = create();
  const sandbox = { window: { RiskI18n: { register(messages) { locale.register(messages); for (const language of ['en','fr']) Object.assign(dictionaries[language],messages[language]); } } } };
  for (const file of ['static','game','extra','live']) vm.runInNewContext(fs.readFileSync(path.join(root,'src/i18n-'+file+'.js'),'utf8'),sandbox,{filename:file});
  return {locale,dictionaries};
}
test('every registered English string has French and the same substitution fields', () => {
  const {locale,dictionaries}=catalogs();
  assert.deepEqual(locale.getDiagnostics().missingFrench,[]);
  assert.deepEqual(locale.getDiagnostics().missingEnglish,[]);
  assert.ok(locale.getDiagnostics().englishKeys > 350);
  const fields=text=>[...new Set([...text.matchAll(/\{(\w+)\}/g)].map(match=>match[1]))].sort();
  for (const [key, english] of Object.entries(dictionaries.en)) assert.deepEqual(fields(dictionaries.fr[key]),fields(english),key);
});
test('old saves default to English while explicit valid language survives normalization', () => {
  const old={totalMoney:12345,musicVolume:.27,sfxVolume:0,pUpgrades:{miner:{lvl:4}},achievements:{firstBlood:{unlocked:true}},prestigeLevel:3,prestigePoints:3};
  const baseline=schema.normalize(old);
  assert.equal(baseline.presentation.language,undefined);
  for (const language of ['en','fr']) {
    const saved=schema.normalize({...old,presentation:{language}});
    assert.equal(saved.presentation.language,language);
    delete saved.presentation.language;
    assert.deepEqual(saved,baseline);
  }
  assert.equal(schema.normalize({...old,presentation:{language:'de'}}).presentation.language,undefined);
  assert.equal(schema.normalize({...old,presentation:Object.create({language:'fr'})}).presentation.language,undefined);
});
test('language switching dispatches once, persists once and rejects unsupported values', () => {
  const events=[],writes=[];
  const select={value:'en'};
  const host={CustomEvent:class {constructor(type,details){this.type=type;this.detail=details.detail;}},document:{documentElement:{lang:'en'},getElementById:()=>select,querySelectorAll:()=>[],addEventListener(){},dispatchEvent:e=>events.push(e)},RiskPresentation:{setPreferences:p=>writes.push(p)}};
  const locale=create(host);
  assert.equal(locale.language,'en');
  assert.equal(locale.setLanguage('__proto__'),false);
  locale.setLanguage('fr'); locale.setLanguage('fr');
  assert.equal(events.length,1); assert.deepEqual(writes,[{language:'fr'}]);
  assert.equal(select.value,'fr'); assert.equal(host.document.documentElement.lang,'fr');
  locale.setLanguage('en',{persist:false});
  assert.equal(events.length,2); assert.equal(writes.length,1);
});
test('display translation writes plain text and leaves unrelated user input untouched', () => {
  const attrs={'data-i18n':'example','data-i18n-vars':'{"name":"<img src=x onerror=alert(1)>"}','data-i18n-title':'example'};
  const node={textContent:'',getAttribute:key=>attrs[key]||null,setAttribute:(key,value)=>{attrs[key]=value;}};
  const untouchedInput={value:'My SAFE_ENTRY name'};
  const locale=create({document:{querySelectorAll:()=>[node],getElementById:()=>null,addEventListener(){}}});
  locale.register({en:{example:'Hello {name}'},fr:{example:'Bonjour {name}'}});
  locale.setLanguage('fr',{persist:false});
  assert.equal(node.textContent,'Bonjour <img src=x onerror=alert(1)>');
  assert.equal(attrs.title,node.textContent); assert.equal(untouchedInput.value,'My SAFE_ENTRY name');
  assert.equal('innerHTML' in node,false);
});
test('large French numbers and bonus display translations do not alter machine status', () => {
  const {locale}=catalogs(); locale.setLanguage('fr');
  const machine='LOCKED'; assert.equal(locale.bonusStatus(machine),'VERROUILLÉ'); assert.equal(machine,'LOCKED');
  assert.equal(locale.bonusStatus('7 HACKS'),'7 HACKS');
  assert.equal(locale.bonusStatus('1 HACKS'),'1 HACK');
  assert.equal(locale.number(1234.5),'1\u202f234,5');
  assert.equal(locale.getDiagnostics().ownTimers,0);
});
