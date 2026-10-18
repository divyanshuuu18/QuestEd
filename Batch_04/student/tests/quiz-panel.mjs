import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
let source=ts.transpileModule(fs.readFileSync('app/components/QuizPanel.tsx','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;
for(const specifier of ['react/jsx-runtime','lucide-react'])source=source.replaceAll('"'+specifier+'"','"'+import.meta.resolve(specifier)+'"').replaceAll("'"+specifier+"'","'"+import.meta.resolve(specifier)+"'");
const {default:QuizPanel}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const question={id:'starter-0',subject:'DSA',topic:'DSA foundations',prompt:'Example prompt',options:['One','Two','Three','Four']};
const props={quiz:{day:'2026-10-11',questions:[question],submitted:false,reward:{max:20}},answers:[1],setAnswers:()=>{},feedback:null,busy:false,onStart:()=>{},onSubmit:()=>{},onProgress:()=>{}};
const before=renderToStaticMarkup(React.createElement(QuizPanel,props));assert.equal(before.includes('Hidden explanation'),false);assert.equal(before.includes('answerCorrect'),false);assert.equal(before.includes('Submit challenge'),true);
const feedback={xp:15,correct:0,feedback:[{answer:0,correct:false,explanation:'Hidden explanation'}]};
const after=renderToStaticMarkup(React.createElement(QuizPanel,{...props,feedback}));assert.equal(after.includes('Hidden explanation'),true);assert.equal(after.includes('answerWrong'),true);assert.equal(after.includes('answerCorrect'),true);assert.equal(after.includes('Submit challenge'),false);
const team=renderToStaticMarkup(React.createElement(QuizPanel,{...props,team:true}));assert.equal(team.includes('TEAM CONTRIBUTION'),true);assert.equal(team.includes('does not create another scored attempt'),true);
const review=renderToStaticMarkup(React.createElement(QuizPanel,{...props,quiz:{...props.quiz,submitted:true,correct:1,questions:[{...question,answer:1,explanation:'Explanation after submission'}]}}));assert.equal(review.includes('Explanation after submission'),true);assert.equal(review.includes('Correct answer'),true);
console.log('PASS: quiz panel hides solutions before submission, marks right/wrong answers afterwards, restores submitted reviews and explains in-place team contribution');

const selector=renderToStaticMarkup(React.createElement(QuizPanel,{...props,quiz:null,subject:'Maths',subjects:['DSA','Web Development','English and Communication Skills','Maths','Chemistry','Constitutional Design'],onSubjectChange:()=>{}}));assert.equal((selector.match(/<option/g)||[]).length,6);assert.ok(selector.includes('One scored attempt per subject each day'));assert.ok(selector.includes('Load subject quiz'));

const faculty=renderToStaticMarkup(React.createElement(QuizPanel,{...props,quiz:{...props.quiz,challenge:{title:'Teacher’s challenge',instructions:'Focus on stacks.'}}}));assert.ok(faculty.includes('Faculty daily challenge'));assert.ok(faculty.includes('Focus on stacks.'));
