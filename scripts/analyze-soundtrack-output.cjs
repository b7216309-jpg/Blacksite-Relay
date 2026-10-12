'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process'),{createRequire}=require('node:module');
const repo=path.resolve(__dirname,'..'),req=createRequire(path.join(repo,'package.json'));
const output=path.resolve(process.env.RISK_V2_QA_DIR||path.join(repo,'dist','qa','soundtrack')),ffmpeg=process.env.RISK_V2_FFMPEG||req('ffmpeg-static');
const input=path.join(output,'actual-transitions.webm');
execFileSync(ffmpeg,['-y','-hide_banner','-loglevel','error','-i',input,'-ar','44100','-ac','2',path.join(output,'actual-transitions.wav')]);
const raw=execFileSync(ffmpeg,['-hide_banner','-loglevel','error','-i',input,'-f','f32le','-ar','44100','-ac','2','pipe:1'],{maxBuffer:128*1024*1024});
let peak=0,sum=0,nonfinite=0,maxJump=0,previous=[0,0],blocks=[],maxQuietBlocks=0,quietBlocks=0;
const blockSamples=882;
for(let base=0;base<raw.length/4;base+=blockSamples){let squares=0,count=0;for(let n=base;n<Math.min(base+blockSamples,raw.length/4);n++){const x=raw.readFloatLE(n*4);if(!Number.isFinite(x)){nonfinite++;continue;}peak=Math.max(peak,Math.abs(x));sum+=x*x;squares+=x*x;count++;if(n>=2)maxJump=Math.max(maxJump,Math.abs(x-previous[n%2]));previous[n%2]=x;}const rms=Math.sqrt(squares/count);blocks.push(rms);quietBlocks=rms<1e-6?quietBlocks+1:0;maxQuietBlocks=Math.max(maxQuietBlocks,quietBlocks);}
const report={method:'full ffmpeg decode of the actual final Web Audio MediaRecorder stream',source:'actual-transitions.webm',audition:'actual-transitions.wav',subjectiveListening:false,sampleRate:44100,channels:2,frames:raw.length/8,durationSeconds:raw.length/8/44100,nonfinite,peak,peakDbFS:20*Math.log10(peak),rms:Math.sqrt(sum/(raw.length/4)),maxAdjacentSampleJump:maxJump,longestDigitalSilenceSeconds:maxQuietBlocks*.01,tenMillisecondRms:blocks};
assert.equal(nonfinite,0);assert(peak<1);assert(report.longestDigitalSilenceSeconds<.2);report.passed=true;
fs.writeFileSync(path.join(output,'output-analysis.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({...report,tenMillisecondRms:undefined}));
