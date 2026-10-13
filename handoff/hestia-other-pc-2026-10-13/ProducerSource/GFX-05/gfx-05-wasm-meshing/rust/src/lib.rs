//! Scalar port of frozen r33 HVP compact greedy/AO kernel. No world/source owner.
use std::cell::RefCell;

const HALO: usize = 34 * 34 * 34;
const MAX_FACES: usize = 50_000;
#[derive(Clone, Copy)]
struct Face { axis: usize, row: usize, col: usize, delta: i32, row_first: bool, bridge: [usize;4] }
const FACES: [Face;6] = [
    Face{axis:0,row:1,col:2,delta:-1,row_first:false,bridge:[0,1,2,3]},
    Face{axis:0,row:1,col:2,delta:1,row_first:true,bridge:[1,2,3,0]},
    Face{axis:1,row:0,col:2,delta:-1,row_first:true,bridge:[1,2,3,0]},
    Face{axis:1,row:0,col:2,delta:1,row_first:false,bridge:[0,1,2,3]},
    Face{axis:2,row:0,col:1,delta:-1,row_first:false,bridge:[1,2,3,0]},
    Face{axis:2,row:0,col:1,delta:1,row_first:true,bridge:[0,1,2,3]}
];
const SIGNS: [[(i32,i32);4];6] = [
    [(-1,-1),(-1,1),(1,1),(1,-1)], [(-1,1),(-1,-1),(1,-1),(1,1)],
    [(-1,1),(-1,-1),(1,-1),(1,1)], [(-1,-1),(-1,1),(1,1),(1,-1)],
    [(1,-1),(-1,-1),(-1,1),(1,1)], [(-1,-1),(1,-1),(1,1),(-1,1)]
];
#[derive(Clone,Copy)]
struct Quad { face: usize, slice: usize, row: usize, col: usize, rows: usize, cols: usize, key: u32 }
struct State {
    input: Vec<u8>, positions: Vec<f32>, normals: Vec<f32>, colors: Vec<f32>,
    indices16: Vec<u16>, indices32: Vec<u32>, ranges: Vec<u32>,
    bounds: [f64;6], quads: usize, unit_faces: usize, ao: bool, index_bytes: u32,
}
impl State {
    fn new() -> Self { Self {input:vec![0;HALO],positions:vec![],normals:vec![],colors:vec![],
        indices16:vec![],indices32:vec![],ranges:vec![],bounds:[0.;6],quads:0,unit_faces:0,ao:false,index_bytes:2} }
    fn clear(&mut self) {
        self.positions.clear();self.normals.clear();self.colors.clear();
        self.indices16.clear();self.indices32.clear();self.ranges.clear();
        self.bounds=[0.;6];self.quads=0;self.unit_faces=0;
    }
}
thread_local! { static STATE: RefCell<State> = RefCell::new(State::new()); }
fn slot(input:&[u8],p:[i32;3])->u8 { input[(p[0]+1+(p[1]+1)*34+(p[2]+1)*34*34) as usize] }
fn key(input:&[u8],p:[i32;3],face:usize,ao:bool)->u32 {
    let material=slot(input,p) as u32;
    if !ao { return material; }
    let f=FACES[face];
    let mut air=p; air[f.axis]+=f.delta;
    let mut signature=0;
    for c in 0..4 {
        let (s1,s2)=SIGNS[face][f.bridge[c]];
        let mut a=air; a[f.row]+=s1;
        let mut b=air; b[f.col]+=s2;
        let mut diagonal=a; diagonal[f.col]+=s2;
        let one=slot(input,a)!=0; let two=slot(input,b)!=0; let corner=slot(input,diagonal)!=0;
        let level=if one&&two {0} else {3-u32::from(one)-u32::from(two)-u32::from(corner)};
        signature |= level<<(c*2);
    }
    material+(signature<<16)
}
fn reserve<T>(v:&mut Vec<T>, n:usize)->Result<(),u32> { v.try_reserve_exact(n).map_err(|_|3) }
fn mesh(s:&mut State,cell:f64,origin:[f64;3],ao:bool,byte_limit:usize)->Result<(),u32> {
    s.clear();s.ao=ao;
    if ![0.125,0.25,0.5].contains(&cell)||origin.iter().any(|v|!v.is_finite()||(*v*8.).fract()!=0.) {return Err(1);}
    if s.input.iter().any(|v|*v>4) {return Err(1);}
    let mut exposed=0;
    for z in 0..32 { for y in 0..32 { for x in 0..32 {
        let p=[x,y,z]; if slot(&s.input,p)==0 {continue;}
        for f in FACES {let mut n=p;n[f.axis]+=f.delta;if slot(&s.input,n)==0 {exposed+=1;}}
    }}}
    if exposed>MAX_FACES {return Err(2);}
    let mut quads=Vec::new(); reserve(&mut quads,exposed)?;
    // Same sorted face/slice/row/column seeds and columns-before-rows rectangles as TS.
    for (fi,f) in FACES.iter().enumerate() {
        for slice in 0..=32 {
            let axis=slice as i32-if f.delta==1 {1} else {0};
            if !(0..32).contains(&axis) {continue;}
            let mut mask=[0_u32;1024];
            for row in 0..32 {for col in 0..32 {
                let mut p=[0;3];p[f.axis]=axis;p[f.row]=row as i32;p[f.col]=col as i32;
                if slot(&s.input,p)==0 {continue;}
                let mut n=p;n[f.axis]+=f.delta;
                if slot(&s.input,n)==0 {mask[row*32+col]=key(&s.input,p,fi,ao);}
            }}
            for row in 0..32 {for col in 0..32 {
                let k=mask[row*32+col];if k==0 {continue;}
                let mut cols=1;while col+cols<32&&mask[row*32+col+cols]==k {cols+=1;}
                let mut rows=1;
                while row+rows<32&&(0..cols).all(|c|mask[(row+rows)*32+col+c]==k) {rows+=1;}
                for r in 0..rows {for c in 0..cols {mask[(row+r)*32+col+c]=0;}}
                quads.push(Quad{face:fi,slice,row,col,rows,cols,key:k});
            }}
        }
    }
    let count=quads.len();let wide=count*4>65535;
    let bytes=count*(96+(if ao {48} else {0})+6*(if wide {4} else {2})+12);
    if bytes>byte_limit {return Err(3);}
    reserve(&mut s.positions,count*12)?;reserve(&mut s.normals,count*12)?;
    if ao {reserve(&mut s.colors,count*12)?;}
    if wide {reserve(&mut s.indices32,count*6)?;} else {reserve(&mut s.indices16,count*6)?;}
    reserve(&mut s.ranges,count*3)?;
    s.index_bytes=if wide {4} else {2};
    for (qi,q) in quads.iter().enumerate() {
        let f=FACES[q.face];
        let plane=origin[f.axis]+q.slice as f64*cell;
        let rs=origin[f.row]+q.row as f64*cell;
        let re=origin[f.row]+(q.row+q.rows) as f64*cell;
        let cs=origin[f.col]+q.col as f64*cell;
        let ce=origin[f.col]+(q.col+q.cols) as f64*cell;
        let spans=if f.row_first {[(rs,cs),(re,cs),(re,ce),(rs,ce)]} else {[(rs,cs),(rs,ce),(re,ce),(re,cs)]};
        let levels:[u32;4]=std::array::from_fn(|c|(q.key>>(16+2*c))&3);
        for (ci,(r,c)) in spans.into_iter().enumerate() {
            let mut p=[plane;3];p[f.row]=r;p[f.col]=c;
            for (axis,v) in p.iter().enumerate() {
                s.positions.push(*v as f32);s.normals.push(if axis==f.axis {f.delta as f32} else {0.});
                if qi==0&&ci==0 {s.bounds[axis]=*v;s.bounds[axis+3]=*v;}
                else {s.bounds[axis]=s.bounds[axis].min(*v);s.bounds[axis+3]=s.bounds[axis+3].max(*v);}
            }
            if ao {let factor=(1.-(0.6*(3-levels[ci]) as f64)/3.) as f32;s.colors.extend([factor;3]);}
        }
        let inverse:[usize;4]=std::array::from_fn(|v|f.bridge.iter().position(|c|*c==v).unwrap());
        let lab:[u32;4]=std::array::from_fn(|v|if ao {levels[inverse[v]]} else {3});
        let pattern=if lab[0]+lab[2]>lab[1]+lab[3] {[0,1,3,1,2,3]} else {[0,1,2,0,2,3]};
        for v in pattern {let i=(qi*4+inverse[v]) as u32;if wide {s.indices32.push(i);} else {s.indices16.push(i as u16);}}
        let material=q.key&65535;
        let len=s.ranges.len();
        if len>0&&s.ranges[len-3]==material {s.ranges[len-1]+=6;}
        else {s.ranges.extend([material,(qi*6) as u32,6]);}
    }
    s.quads=count;s.unit_faces=exposed;
    Ok(())
}
#[no_mangle] pub extern "C" fn input_ptr()->usize {STATE.with(|s|s.borrow_mut().input.as_mut_ptr() as usize)}
#[no_mangle] pub extern "C" fn run(cell:f64,x:f64,y:f64,z:f64,ao:u32,limit:usize)->u32 {
    if ao>1||limit>16*1024*1024 {STATE.with(|s|s.borrow_mut().clear());return 1;}
    STATE.with(|s| {let mut state=s.borrow_mut();match mesh(&mut state,cell,[x,y,z],ao!=0,limit) {
        Ok(())=>0,Err(code)=>{state.clear();code}
    }})
}
#[no_mangle] pub extern "C" fn count(channel:u32)->usize {STATE.with(|s| {let s=s.borrow();match channel {
    0=>s.positions.len(),1=>s.normals.len(),2=>if s.index_bytes==4 {s.indices32.len()} else {s.indices16.len()},
    3=>s.colors.len(),4=>s.ranges.len(),5=>6,6=>s.quads,7=>s.unit_faces,8=>s.index_bytes as usize,_=>0
}})}
#[no_mangle] pub extern "C" fn pointer(channel:u32)->usize {STATE.with(|s| {let s=s.borrow();match channel {
    0=>s.positions.as_ptr() as usize,1=>s.normals.as_ptr() as usize,
    2=>if s.index_bytes==4 {s.indices32.as_ptr() as usize} else {s.indices16.as_ptr() as usize},
    3=>s.colors.as_ptr() as usize,4=>s.ranges.as_ptr() as usize,5=>s.bounds.as_ptr() as usize,_=>0
}})}
#[no_mangle] pub extern "C" fn release(){STATE.with(|s| {let mut s=s.borrow_mut();s.clear();
    s.positions=vec![];s.normals=vec![];s.colors=vec![];s.indices16=vec![];s.indices32=vec![];s.ranges=vec![];
});}
#[no_mangle] pub extern "C" fn allocation_probe(bytes:usize)->u32 {
    let mut v=Vec::<u8>::new();if v.try_reserve_exact(bytes).is_err() {3} else {0}
}
