export function projectRoles(root,knownChild,items){
 const direct=items.filter(p=>p.parent===root);
 const child=knownChild||(direct.length===1?direct[0].pid:0);
 if(!child||!direct.some(p=>p.pid===child))throw new Error('unique verified child graph required');
 return items.map(p=>({pid:p.pid,role:p.pid===child?'child':p.parent===child?'grandchild':p.parent===root?'sibling':(()=>{throw new Error('unknown verified graph')})()}));
}
export function releaseGate(role,s){return Boolean(s.cancel||(role==='grandchild'&&(s.release||s.grandchildRelease))||(role==='sibling'&&s.siblingRelease));}
