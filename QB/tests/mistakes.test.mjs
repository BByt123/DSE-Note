import test from 'node:test';
import assert from 'node:assert/strict';
import {addIncorrectAnswersToNotebook,MISTAKE_NOTEBOOK_ID,MISTAKE_NOTEBOOK_NAME} from '../lib.mjs';

test('answered incorrect MC questions are saved and categorized once',()=>{
 const questions=[
  {id:'wrong',type:'MC',answer:'C'},
  {id:'correct',type:'MC',answer:'A'},
  {id:'blank',type:'MC',answer:'B'},
  {id:'written',type:'Essay',answer:''}
 ];
 const responses={wrong:'A',correct:'A',blank:'',written:'An answer'};
 const personal={bookmarks:[],collections:[]};
 assert.deepEqual(addIncorrectAnswersToNotebook(questions,responses,personal),['wrong']);
 assert.deepEqual(personal.bookmarks,['wrong']);
 assert.deepEqual(personal.collections,[{id:MISTAKE_NOTEBOOK_ID,name:MISTAKE_NOTEBOOK_NAME,ids:['wrong']}]);
 assert.deepEqual(addIncorrectAnswersToNotebook(questions,responses,personal),[]);
 assert.deepEqual(personal.bookmarks,['wrong']);
});

test('the mistake notebook restores questions already saved in another view',()=>{
 const personal={bookmarks:['wrong'],collections:[{id:'revision',name:'Revision',ids:[]}]};
 assert.deepEqual(addIncorrectAnswersToNotebook([{id:'wrong',type:'MC',answer:'D'}],{wrong:'B'},personal),['wrong']);
 assert.deepEqual(personal.collections.find(collection=>collection.name===MISTAKE_NOTEBOOK_NAME).ids,['wrong']);
});
