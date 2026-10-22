// Pure source-text predicates. Never execute the C# under inspection.
export function methodBody(source,name){
 const clean=source.replace(/@"(?:[^"]|"")*"|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\/\/[^\n]*|\/\*[\s\S]*?\*\//g,x=>' '.repeat(x.length));
 const match=new RegExp('\\b'+name+'\\s*\\([^;{}]*\\)\\s*\\{').exec(clean);if(!match)return '';
 const start=clean.indexOf('{',match.index);let depth=1,i=start+1;
 for(;i<clean.length&&depth;i++){if(clean[i]==='{')depth++;else if(clean[i]==='}')depth--}
 return source.slice(start,i);
}
export function closeOnlyReclaim(source){
 const b=methodBody(source,'ReclaimBeforePrepare'),mark=b.indexOf('t.ReclaimAttempted=true'),call=b.indexOf('DuplicateHandle(');
 return b.includes('ProvedAbsent(path)')&&b.includes('TransferState.DuplicatedLocal')&&mark>=0&&call>mark
 &&/DuplicateHandle\(ObserverTarget\(q\),remote,IntPtr\.Zero,out ignored,0,false,0x00000001\)/.test(b)
 &&b.includes('t.Remote=IntPtr.Zero')&&b.includes('q.ForceObserverRetirement=true')
 &&!b.includes('GetCurrentProcess')&&!b.includes('LocalReclaimed')&&!b.includes('CloseChecked')&&!b.includes('0x00000002');
}
export function parentQueryTransfers(source){
 const a=methodBody(source,'ObserveOwned'),b=methodBody(source,'RunFutureCase');
 return a.includes('out t.Remote,ProcessQueryInformation|ProcessQueryLimitedInformation|Synchronize,false,0')
 &&b.includes('DuplicateTo(q.Observer.Owner.Process,q.Supervisor,ProcessQueryInformation|ProcessQueryLimitedInformation|Synchronize|0x0040)')
 &&b.includes('DuplicateTo(q.Canary.Owner.Process,q.Supervisor,ProcessQueryInformation|ProcessQueryLimitedInformation|Synchronize)')
 &&source.includes('private const uint ProcessQueryInformation=0x0400;');
}
export function finalPublicationDeadline(source){
 const b=methodBody(source,'RunFutureQualificationSuite'),publication=b.indexOf('Publish(Path.Combine(root,"suite.result.tsv")');
 const cleanup=b.indexOf('bool cleanupWithinDeadline=SuiteDeadlineHolds'),final=b.indexOf('bool publicationWithinDeadline=SuiteDeadlineHolds');
 return publication>=0&&cleanup>=0&&cleanup<publication&&final>publication
 &&b.includes('QUAL_SUITE_CASE_CANDIDATES')&&b.includes('passed==6&&cleanupWithinDeadline&&publicationWithinDeadline?0:2')
 &&methodBody(source,'SuiteDeadlineHolds').includes('now<=suite.OverallEnd')&&methodBody(source,'SuiteDeadlineHolds').includes('utcNow<=suite.UtcEnd');
}
