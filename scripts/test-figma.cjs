// Structural tests for the local Figma plugin. No Figma account required.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
let serial = 0;
const registry = new Map();
class Node {
  constructor(type) {
    this.type = type; this.id = `mock:${++serial}`; this.name = type;
    this._children = []; this.data = {}; this._reactions = [];
    this.x = this.y = 0; this.width = this.height = 100; this.characters = '';
    registry.set(this.id, this);
  }
  get reactions(){return this._reactions;}
  set reactions(value){throw new TypeError('reactions is read-only with dynamic-page; use setReactionsAsync');}
  set scrollBehavior(value){throw new TypeError('object is not extensible: scrollBehavior is not a Plugin API property');}
  get scrollBehavior(){return undefined;}
  get removed() { return this.deleted || !!(this.parent && this.parent.removed); }
  get children() { assert(!this.removed,`in get_children: The node with id "${this.id}" does not exist`); return this._children; }
  appendChild(n) { if(n.parent) n.parent.children.splice(n.parent.children.indexOf(n),1); this.children.push(n); n.parent=this; }
  insertChild(index,n) { if(n.parent) n.parent.children.splice(n.parent.children.indexOf(n),1);this.children.splice(index,0,n);n.parent=this; }
  resize(w,h) { assert(w>0 && h>0); this.width=w; this.height=h; }
  resizeWithoutConstraints(w,h) { this.resize(w,h); }
  remove() { if(this.parent) this.parent.children.splice(this.parent.children.indexOf(this),1); this.deleted=true; }
  setPluginData(k,v) { this.data[k]=v; }
  getPluginData(k) { return this.data[k] || ''; }
  setRelaunchData() {}
  setBoundVariable(k,v) { this.boundVariables={...this.boundVariables,[k]:{type:'VARIABLE_ALIAS',id:v.id}}; }
  async setTextStyleIdAsync(id) { this.textStyleId=id; }
  async setEffectStyleIdAsync(id) { this.effectStyleId=id; }
  addComponentProperty(name,type,value) { const key=name+'#'+this.id+':'+(++serial);this.componentPropertyDefinitions={...this.componentPropertyDefinitions,[key]:{type,defaultValue:value}};return key; }
  createInstance() {layoutComponent(this);const n=this.clone();n.type='INSTANCE';n.mainComponentId=this.id;return n;}
  get componentProperties(){const master=registry.get(this.mainComponentId),owner=master&&master.parent&&master.parent.type==='COMPONENT_SET'?master.parent:master;const defs=owner&&owner.componentPropertyDefinitions||{};const used=new Set(walk(this).flatMap(n=>Object.values(n.componentPropertyReferences||{})));return Object.fromEntries(Object.entries(defs).filter(([key])=>used.has(key)).map(([key,d])=>[key,{type:d.type,value:this._propertyOverrides&&key in this._propertyOverrides?this._propertyOverrides[key]:d.defaultValue}]));}
  setProperties(props) {const available=this.componentProperties;for(const key of Object.keys(props))assert(key in available,`Could not find a component property with name: '${key}'`);this._propertyOverrides={...this._propertyOverrides,...props};for(const n of walk(this)){const refs=n.componentPropertyReferences||{};if(refs.characters in props)n.characters=props[refs.characters];if(refs.visible in props)n.visible=props[refs.visible];}}
  async loadAsync() {}
  clone() {
    const n=new Node(this.type);
    for(const [k,v] of Object.entries(this)) if(!['id','parent','_children','deleted'].includes(k)) n[k]=structuredClone(v);
    for(const child of this.children) n.appendChild(child.clone());
    if(this.parent) this.parent.appendChild(n);
    return n;
  }
  async setReactionsAsync(reactions) {
    for(const r of reactions) {
      if(r.trigger!==null){
        const t=r.trigger;
        assert(t && ['ON_CLICK','ON_HOVER','ON_PRESS','ON_DRAG','ON_MEDIA_END','AFTER_TIMEOUT','MOUSE_ENTER','MOUSE_LEAVE','MOUSE_UP','MOUSE_DOWN','ON_KEY_DOWN','ON_MEDIA_HIT'].includes(t.type),`invalid Figma trigger: ${t && t.type}`);
        if(t.type==='AFTER_TIMEOUT')assert(Number.isFinite(t.timeout),'missing trigger timeout');
        if(t.type.startsWith('MOUSE_'))assert(Number.isFinite(t.delay),'missing trigger delay');
        if(t.type==='ON_KEY_DOWN')assert(t.device && Array.isArray(t.keyCodes),'missing keyboard trigger fields');
        if(t.type==='ON_MEDIA_HIT')assert(Number.isFinite(t.mediaHitTime),'missing mediaHitTime');
      }
      assert.equal(r.actions.length,1);
      const a=r.actions[0];
      if(a.type==='URL'){assert(a.url.startsWith('https://www.google.com/maps'));continue;}
      if(a.type==='NODE') {
        const dest=registry.get(a.destinationId);
        assert(dest && !dest.removed,`missing destination from ${this.name}`);
        if(a.navigation==='CHANGE_TO'){assert.equal(dest.type,'COMPONENT');assert.equal(dest.parent,this.parent);continue;}
        if(a.navigation==='SCROLL_TO'){assert.equal(screenOf(this),screenOf(dest),'scroll within own screen');continue;}
        assert.equal(dest.type,'FRAME');
        assert(['PAGE','SECTION'].includes(dest.parent.type),'nested destination');
        assert.equal(pageOf(this),pageOf(dest),'cross-page navigation');
        if(a.navigation==='NAVIGATE') assert.notEqual(screenOf(this),dest,`self navigation: ${this.name}`);
      }
    }
    this._reactions=structuredClone(reactions);
  }
}
function layoutComponent(n){
  if(n.type!=='COMPONENT')return;assert.equal(n.layoutMode,'HORIZONTAL');const gap=n.itemSpacing||0,children=n.children;
  for(const c of children)if(c.type==='TEXT'&&c.textAutoResize==='WIDTH_AND_HEIGHT'){c.width=Math.min(c.maxWidth??Infinity,Math.max(1,c.characters.length*c.fontSize*.53));c.height=c.lineHeight?.value??Math.ceil(c.fontSize*1.43);}
  const available=n.width-(n.paddingLeft||0)-(n.paddingRight||0),total=children.reduce((v,c)=>v+c.width,0)+Math.max(0,children.length-1)*gap,grow=children.reduce((v,c)=>v+(c.layoutGrow||0),0);
  if(grow)for(const c of children)c.width+=Math.max(0,available-total)*(c.layoutGrow||0)/grow;
  const occupied=children.reduce((v,c)=>v+c.width,0)+Math.max(0,children.length-1)*gap;let x=(n.paddingLeft||0)+(n.primaryAxisAlignItems==='CENTER'?(available-occupied)/2:0);
  for(const c of children){const area=n.height-(n.paddingTop||0)-(n.paddingBottom||0);if(c.layoutAlign==='STRETCH')c.height=area;c.x=x;c.y=(n.paddingTop||0)+(n.counterAxisAlignItems==='CENTER'?(area-c.height)/2:0);x+=c.width+gap;}
}
function pageOf(n) { while(n && n.type!=='PAGE') n=n.parent; return n; }
function screenOf(n) { while(n && n.parent && !['PAGE','SECTION'].includes(n.parent.type)) n=n.parent; return n; }
function relativeX(n,parent){let x=0;while(n&&n!==parent){x+=n.x;n=n.parent;}return x;}
function relativeY(n,parent){let y=0;while(n&&n!==parent){y+=n.y;n=n.parent;}return y;}
function walk(n) { return [n,...n.children.flatMap(walk)]; }
const images=new Map();
const root=new Node('DOCUMENT'), initial=new Node('PAGE');initial.name='Page 1';root.appendChild(initial);
const messages=[],collections=[],variables=[],paintStyles=[],textStyles=[],effectStyles=[];
function style(list){const s=new Node('STYLE');list.push(s);return s;}
const figma={
  root,currentPage:initial,showUI(){},closePlugin(){},getImageByHash(hash){const bytes=images.get(hash);return bytes?{getBytesAsync:async()=>new Uint8Array(bytes)}:null;},createImage(bytes){assert(bytes.length>20);const hash='image:'+images.size;images.set(hash,Buffer.from(bytes));return {hash};},
  ui:{postMessage(m){messages.push(m);},resize(){}},
  variables:{async getLocalVariableCollectionsAsync(){return collections.filter(c=>!c.deleted);},async getLocalVariablesAsync(){return variables;},createVariableCollection(name){const c=new Node('COLLECTION');c.name=name;c.modes=[{modeId:c.id,name:'Mode 1'}];c.renameMode=(id,name)=>c.modes[0].name=name;collections.push(c);return c;},createVariable(name,c,type){const v=new Node('VARIABLE');v.name=name;v.variableCollectionId=c.id;v.resolvedType=type;v.valuesByMode={};v.codeSyntax={};v.setValueForMode=(id,value)=>v.valuesByMode[id]=value;v.setVariableCodeSyntax=(p,s)=>v.codeSyntax[p]=s;variables.push(v);return v;},createVariableAlias(v){return{type:'VARIABLE_ALIAS',id:v.id};},setBoundVariableForPaint(p,k,v){return{...p,boundVariables:{[k]:{type:'VARIABLE_ALIAS',id:v.id}}};}},
  async getLocalPaintStylesAsync(){return paintStyles;},async getLocalTextStylesAsync(){return textStyles;},async getLocalEffectStylesAsync(){return effectStyles;},
  createPaintStyle(){return style(paintStyles);},createTextStyle(){return style(textStyles);},createEffectStyle(){return style(effectStyles);},
  combineAsVariants(nodes,parent){
    const s=new Node('COMPONENT_SET');parent.appendChild(s);s.componentPropertyDefinitions={};
    // Exercise the ID-normalization case: cached pre-combine keys are invalid.
    for(const n of nodes){const remap=new Map();for(const [old,d] of Object.entries(n.componentPropertyDefinitions||{})){const name=old.split('#')[0];let key=Object.keys(s.componentPropertyDefinitions).find(k=>k.split('#')[0]===name);if(!key){key=name+'#'+s.id+':'+(++serial);s.componentPropertyDefinitions[key]=structuredClone(d);}remap.set(old,key);}for(const child of walk(n)){if(child.componentPropertyReferences)child.componentPropertyReferences=Object.fromEntries(Object.entries(child.componentPropertyReferences).map(([field,key])=>[field,remap.get(key)||key]));}s.appendChild(n);n.componentPropertyDefinitions={};}
    return s;
  },
  viewport:{scrollAndZoomIntoView(){}},
  async setCurrentPageAsync(p){this.currentPage=p;},
  async listAvailableFontsAsync(){return [...['Regular','Semi Bold','Bold','Black'].map(style=>({fontName:{family:'Nunito Sans',style}})),...['Regular','Semi Bold','Bold','Black'].map(style=>({fontName:{family:'Inter',style}})),{fontName:{family:'Georgia',style:'Bold Italic'}}];},
  async loadFontAsync(){},
};
for(const [method,type] of Object.entries({createPage:'PAGE',createFrame:'FRAME',createSection:'SECTION',createComponent:'COMPONENT',createRectangle:'RECTANGLE',createText:'TEXT',createNodeFromSvg:'FRAME'}))
  figma[method]=()=>{const n=new Node(type); (type==='PAGE'?root:figma.currentPage).appendChild(n); return n;};
figma.createNodeFromSvg=(svg)=>{const n=new Node('FRAME');n.svgSource=svg;figma.currentPage.appendChild(n);return n;};
let bundledData;
vm.runInNewContext(fs.readFileSync(process.env.THUTHANH_PLUGIN_SOURCE||require('node:path').join(__dirname,'../design/figma/code.js'),'utf8').replace('catch (e) { const detail=', 'catch (e) { if(!String(e.message).startsWith("Đã dừng tạo"))console.error(e.stack); const detail=')+'\ncapture(DATA);',{figma,__html__:'',setTimeout,console,capture:d=>bundledData=d});
async function build() {
  messages.length=0; await figma.ui.onmessage({type:'build'});
  assert(!messages.some(m=>m.type==='error'),JSON.stringify(messages.at(-1)));
  assert(messages.some(m=>m.type==='success'));
}

// This executes the real plugin against an in-memory Figma API, not a live canvas.
(async()=>{
  const path=require('node:path'),crypto=require('node:crypto');
  const dir=path.join(__dirname,'../design/figma'),data=JSON.parse(JSON.stringify(bundledData));assert.equal(data.build.version,35);assert.equal(data.build.source_sha256,crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,'src/plugin.js'))).digest('hex'));
  assert.equal(data.products.length,24);assert.equal(new Set(data.products.map(p=>p.id)).size,24);
  assert.equal(data.additionalBanners.length,2);for(const banner of data.additionalBanners){assert.equal(crypto.createHash('sha256').update(Buffer.from(banner.image,'base64')).digest('hex'),banner.sha256);assert.equal(banner.width,900);assert.equal(banner.height,506);}
  assert.equal(data.products[0].id,'TT-SGK-002');for(const cat of new Set(data.products.map(p=>p.category)))assert.equal(data.products.filter(p=>p.category===cat).length,4);
  const importedCatalog=path.join(__dirname,'../.runtime/product-import/ae2ca77c65437321/catalog.json');
  const source=JSON.parse(fs.readFileSync(fs.existsSync(importedCatalog)?importedCatalog:path.join(__dirname,'../backend/database/catalog.json'),'utf8'));
  for(const p of data.products){const actual=source.products.find(x=>x.sku===p.id);assert(actual);assert.equal(actual.name,p.name);assert.equal(crypto.createHash('sha256').update(Buffer.from(p.image,'base64')).digest('hex'),p.image_sha256);assert.equal(p.image_format,'PNG');assert(Buffer.from(p.image,'base64').subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])));}
  assert.equal(data.brands.length,10);for(const brand of data.brands)assert.equal(crypto.createHash('sha256').update(Buffer.from(brand.image,'base64')).digest('hex'),brand.sha256);
  const webLogos=JSON.parse(fs.readFileSync(path.join(__dirname,'../frontend/src/lib/brands.json'),'utf8'));assert.deepEqual(data.brands.map(b=>b.name),webLogos.map(b=>b.name));for(const tone of ['dark','light'])assert.equal(data.brandSvgs[tone],fs.readFileSync(path.join(__dirname,'../frontend/public/brand/logo-'+tone+'.svg'),'utf8'));
  const adminSource=fs.readFileSync(path.join(__dirname,'../frontend/src/components/admin-icon.tsx'),'utf8');for(const [,name,glyph] of adminSource.matchAll(/^  (\w+): \["([^"]+)"\]/gm))assert(data.icons['admin-'+name].includes(glyph));
  const manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8'));assert.deepEqual(manifest.networkAccess.allowedDomains,['none']);assert.equal(manifest.documentAccess,'dynamic-page');
  const html=fs.readFileSync(path.join(dir,'ui.html'),'utf8');new vm.Script(html.match(/<script>([\s\S]*?)<\/script>/)[1]);
  const legacy=new Node('SECTION');legacy.name='V20 owned';legacy.setPluginData('thuthanhV20','1');const legacyPhoto=new Node('RECTANGLE');legacyPhoto.setPluginData('productId','TT-SGK-002');legacyPhoto.setPluginData('imageSlot','1');legacyPhoto.fills=[{type:'IMAGE',imageHash:figma.createImage(Buffer.from(data.products[0].legacyImage,'base64')).hash}];legacy.appendChild(legacyPhoto);const page=new Node('PAGE');page.name='01 · Máy tính · thuthanh Clicon';root.appendChild(page);page.appendChild(legacy);
  const manual=new Node('FRAME');manual.name='User artwork outside plugin';page.appendChild(manual);
  const previousVersion=new Node('FRAME');previousVersion.name='Owned V31 to upgrade';previousVersion.setPluginData('thuthanhV31','1');page.appendChild(previousVersion);
  await build();const upgraded=walk(page).find(n=>n.getPluginData('imageSlot')==='1'&&n.getPluginData('productId')==='TT-SGK-002'&&!n.removed);assert.equal(require('node:crypto').createHash('sha256').update(images.get(upgraded.fills[0].imageHash)).digest('hex'),data.products[0].image_sha256,'old generated thumbnail must upgrade to HD');assert(legacy.removed);assert(!manual.removed);
  assert(previousVersion.removed,'upgrade recognizes V31 ownership');
  const liveNodes=walk(root);function treeDepth(n){return n.children.length?1+Math.max(...n.children.map(treeDepth)):1;}const complexity={nodes:liveNodes.length,bands:liveNodes.filter(n=>n.getPluginData('autoLayoutBand')==='1').length,depth:treeDepth(root)};assert(complexity.nodes<34000,'native import node budget');assert(complexity.depth<=16,'native import nesting budget');
  const pages=root.children.filter(p=>p.name.includes('thuthanh Clicon'));assert.equal(pages.length,2);
  let screensTotal=0,routeTotal=0,overflows=[];
  const screenCache=new WeakMap();
  const byScreen=(page,id)=>{if(!screenCache.has(page))screenCache.set(page,new Map(walk(page).filter(n=>n.getPluginData('screenId')).map(n=>[n.getPluginData('screenId'),n])));return screenCache.get(page).get(id);};
  const dest=(f,target)=>{const node=walk(f).find(n=>n.getPluginData('routeTarget')===target);assert(node,`${f.name} missing route ${target}`);const action=node.reactions[0]?.actions[0];assert(action);return registry.get(action.destinationId);};
  for(const page of pages){
    const mobile=page.name.includes('Điện thoại'),width=mobile?402:1920,owned=page.children.filter(n=>n.getPluginData('thuthanhV35')==='1');
    const labels=owned.filter(n=>n.getPluginData('layoutLabel')==='1');assert.equal(labels.length,7);assert(!page.children.some(n=>n.type==='SECTION'),'no enclosing flow boards');
    const screens=owned.filter(n=>n.getPluginData('screenId'));assert.equal(screens.length,89);assert.equal(new Set(screens.map(n=>n.getPluginData('screenId'))).size,screens.length);screensTotal+=screens.length;const nodes=owned.filter(n=>n.getPluginData('componentLibrary')!=='1').flatMap(walk);
    const intersects=(a,b)=>a.x<b.x+b.width&&b.x<a.x+a.width&&a.y<b.y+b.height&&b.y<a.y+a.height;
    for(let i=0;i<owned.length;i++)for(let j=i+1;j<owned.length;j++)assert(!intersects(owned[i],owned[j]),'top-level canvas nodes overlap');
    for(const label of labels){const list=screens.filter(f=>f.getPluginData('flowId')===label.getPluginData('flowId')&&f.getPluginData('screenId')!=='home').sort((a,b)=>a.x-b.x);for(const y of new Set(list.map(f=>f.y))){const row=list.filter(f=>f.y===y).sort((a,b)=>a.x-b.x);assert(row.length<=12,'maximum12screens per row');for(let i=1;i<row.length;i++)assert(row[i].x-row[i-1].x-row[i-1].width>=320,'readable flow gap');}}
    for(const f of screens){assert.equal(f.width,width);assert.equal(f.getPluginData('visualTheme'),'Clicon / thuthanh / V35');if(f.getPluginData('overlay')!=='1'){assert.equal(f.height,mobile?874:1080);assert.equal(walk(f).some(n=>n.getPluginData('siteFooter')==='1'),!(/^admin/.test(f.getPluginData('screenId'))||f.getPluginData('screenId')==='stockAdjust'));}}
    const composed=nodes.filter(n=>n.type==='FRAME'&&!n.svgSource&&!n.getPluginData('brandWordmark')&&!n.getPluginData('iconSource'));assert(composed.every(n=>['HORIZONTAL','VERTICAL'].includes(n.layoutMode)),'all composed frames use native Auto Layout');
    for(const button of nodes.filter(n=>n.type==='INSTANCE'&&n.getPluginData('uiRole')==='button')){const content=button.children;for(const label of content.filter(n=>n.type==='TEXT')){assert.equal(label.textAutoResize,'WIDTH_AND_HEIGHT','button labels must hug their text');assert.equal(label.layoutGrow,0);assert.notEqual(label.layoutAlign,'STRETCH');assert.equal(label.textAlignVertical,'CENTER');}if(content.length){const left=Math.min(...content.map(c=>c.x)),right=Math.max(...content.map(c=>c.x+c.width));assert(Math.abs((left+right)/2-button.width/2)<1,'component content horizontal center');for(const c of content){assert(Math.abs(c.y+c.height/2-button.height/2)<1,'component content vertical center');assert(c.x>=0&&c.x+c.width<=button.width+.1,'component content containment');}}}
    assert(owned.some(n=>n.getPluginData('componentLibrary')==='1'&&walk(n).some(c=>c.type==='COMPONENT')),'reusable component masters');assert(nodes.some(n=>n.type==='INSTANCE'&&n.getPluginData('uiRole')==='button'),'buttons use component instances');
    assert(nodes.some(n=>(n.paddingLeft||0)>0&&(n.paddingTop||0)>0),'real padding exists');
    // Check computed flow positions, not merely the layoutMode flag.
    for(const n of nodes.filter(n=>n.getPluginData('nativeAutoLayout')==='1'&&n.getPluginData('semanticAutoLayout')!=='1')){let cursor=n.layoutMode==='HORIZONTAL'?n.paddingLeft:n.paddingTop;for(const c of n.children.filter(c=>c.layoutPositioning!=='ABSOLUTE')){const x=n.layoutMode==='HORIZONTAL'?cursor:n.paddingLeft,y=n.layoutMode==='VERTICAL'?cursor:n.paddingTop;assert(Math.abs(c.x-x)<.1&&Math.abs(c.y-y)<.1,'native flow geometry: '+n.name+'/'+c.name);cursor+=(n.layoutMode==='HORIZONTAL'?c.width:c.height)+(n.itemSpacing||0);}}

    for(const h of nodes.filter(n=>n.getPluginData('headerRoot')==='1')){assert.equal(h.height,mobile?72:88);assert.equal(h.getPluginData('singleRow'),'1');}
    for(const partner of nodes.filter(n=>n.getPluginData('partnersSection')==='1')){assert.equal(walk(partner).filter(n=>n.getPluginData('manufacturerBrand')).length,10);assert(walk(partner).some(n=>n.characters==='Đối tác'));assert(!walk(partner).some(n=>n.getPluginData('siteFooter')==='1'));}
    if(mobile)for(const f of screens.filter(f=>f.getPluginData('overlay')!=='1'&&!/^admin/.test(f.getPluginData('screenId'))&&f.getPluginData('screenId')!=='stockAdjust')){assert.equal(f.numberOfFixedChildren,1);assert.equal(f.children.at(-1).getPluginData('mobileBottomNav'),'1');assert.equal(walk(f.children.at(-1)).filter(n=>n.reactions.length).length,['home','catalog','cart','account'].includes(f.getPluginData('screenId'))?3:4);}
    for(const n of nodes.filter(n=>n.getPluginData('headerAnnouncement')==='1'))assert.equal(n.characters,'Chào mừng đến với nhà sách Thu Thanh');
    assert.equal(nodes.filter(n=>n.getPluginData('headerAnnouncement')==='1').length,0);assert(!nodes.some(n=>n.getPluginData('campaignId')==='header'));assert(nodes.filter(n=>n.type==='TEXT').some(n=>n.fontName?.family==='Nunito Sans'));
    for(const n of nodes.filter(n=>n.getPluginData('brandWordmark')==='1'))assert.equal(n.getPluginData('brandLabel'),'NHÀ SÁCH THU THANH');
    for(const n of nodes.filter(n=>n.getPluginData('productCard'))){assert(mobile?[166,177].some(w=>Math.abs(w-n.width)<0.01):[234,299,318].some(w=>Math.abs(w-n.width)<0.01),'Clicon grid geometry');assert.equal(n.height,mobile?396:516);}
    for(const card of nodes.filter(n=>n.getPluginData('productCard'))){const parts=walk(card).filter(n=>n.getPluginData('productTitle')==='1'||n.getPluginData('imageSlot')==='1'||n.getPluginData('priceRegion')==='1'||n.getPluginData('cardActions')==='1').sort((a,b)=>relativeY(a,card)-relativeY(b,card));for(let i=1;i<parts.length;i++)assert(relativeY(parts[i],card)>=relativeY(parts[i-1],card)+parts[i-1].height,'card regions overlap');}
    for(const n of nodes){for(const r of n.reactions){routeTotal++;for(const a of r.actions)if(a.destinationId){const target=registry.get(a.destinationId);assert(target&&!target.removed);if(target.getPluginData('overlay')==='1')assert.equal(a.navigation,screenOf(n).getPluginData('overlay')==='1'?'SWAP':'OVERLAY');}}
      // Horizontal containment catches malformed field, table and button placement.
      if(['TEXT','RECTANGLE','FRAME'].includes(n.type)&&n.parent?.type==='FRAME'&&n.parent.getPluginData('screenId')===''&&n.parent.overflowDirection!=='HORIZONTAL')if(n.x < -1 || n.x+n.width > n.parent.width+1)overflows.push(`${page.name}: ${n.parent.name}/${n.name}: ${n.x}+${n.width}>${n.parent.width}`);
    }
    const textLabels=nodes.filter(n=>n.type==='TEXT').map(n=>n.characters);assert(!textLabels.some(s=>/USD|Shop Now|Best Seller|Wishlist|Đổi trả 30|Miễn phí giao hàng cho đơn/.test(s)));
    for(const id of ['home','catalog','detail','login','register','cartEmpty','validation','orders','cancelConfirm','paymentQr','adminDashboard','adminProducts','adminInventory','uiStates'])assert(byScreen(page,id),id);
    assert(!screens.some(n=>/^(product_|grade\d|price\d|catalogPage|flow\d)/.test(n.getPluginData('screenId'))));
    for(const card of nodes.filter(n=>n.getPluginData('productCard'))){const clickable=walk(card).filter(n=>n.reactions.length);if(card.getPluginData('productCard')!=='TT-SGK-002')assert.equal(clickable.length,0,'only first SKU is interactive');}
    for(const id of ['delivery','pickup','deliveryTwo','pickupTwo']){
      const f=byScreen(page,id),sum=walk(f).find(n=>n.name==='Tổng đơn hàng'),quantity=id.endsWith('Two')?2:1;
      const expectedSub=id.endsWith('Many')?34500:14000*quantity,expectedFee=id.startsWith('pickup')?0:25000;
      assert.equal(Number(sum.getPluginData('subtotal')),expectedSub);assert.equal(Number(sum.getPluginData('shipping')),expectedFee);assert.equal(Number(sum.getPluginData('total')),expectedSub+expectedFee);
    }
    assert.equal(dest(byScreen(page,'cartTwo'),'cart'),byScreen(page,'cart'));assert.equal(dest(byScreen(page,'cart'),'cartTwo'),byScreen(page,'cartTwo'));assert.equal(dest(byScreen(page,'cartTwo'),'deliveryTwo'),byScreen(page,'deliveryTwo'));assert.equal(dest(byScreen(page,'deliveryTwo'),'pickupTwo'),byScreen(page,'pickupTwo'));
    assert.equal(dest(byScreen(page,'paidOrderTwo'),'ordersPaid'),byScreen(page,'ordersPaid'));assert(walk(byScreen(page,'paidOrderTwo')).some(n=>n.characters==='#TT-MAU-GIAO-2'));
    for(const id of ['quick','quickTwo','quickSigned','quickSignedTwo','newsletterSuccess','cancelConfirm','adminSaveConfirm']){const f=byScreen(page,id),back=walk(f).find(n=>n.getPluginData('closeOverlay')==='1');assert.equal(back.reactions[0].actions[0].type,'CLOSE');}
    for(const n of nodes.filter(n=>n.getPluginData('routeTarget').startsWith('product_'))){const target=n.getPluginData('routeTarget'),id=target.slice(8),f=byScreen(page,target),actual=data.products.find(p=>p.id===id);assert(walk(f).some(n=>n.characters===actual.name),target);}
    const catalogIds=new Set();for(const id of ['catalog','category1','category2','category3','category4','category5']){const cards=walk(byScreen(page,id)).filter(n=>n.getPluginData('productCard'));assert.equal(cards.length,4);cards.forEach(n=>catalogIds.add(n.getPluginData('productCard')));}assert.equal(catalogIds.size,24);
    for(const id of ['home','catalog','detail','cart','cartTwo','policies']){
      assert(!walk(byScreen(page,id)).some(n=>n.type==='TEXT' && /25\.000/.test(n.characters)),id+' must not advertise shipping amount');
    }
    for(const foot of nodes.filter(n=>n.getPluginData('siteFooter')==='1')){assert.equal(walk(foot).filter(n=>n.getPluginData('manufacturerBrand')).length,0);assert(walk(foot).some(n=>n.characters.includes('295 Tôn Đức Thắng')));assert(walk(foot).some(n=>n.characters==='Đăng ký nhận bản tin'));}
    const referenceBanners=walk(byScreen(page,'home')).filter(n=>n.getPluginData('referenceBanner'));assert.equal(referenceBanners.length,2);for(const banner of referenceBanners)assert(Math.abs(banner.height/banner.width-506/900)<0.001,'original banner aspect ratio');
    assert(!nodes.some(n=>n.name==='Cam kết mua hàng'));
    for(const [id,amount] of [['paymentQr',39000],['paymentQrTwo',53000],['pickupPaymentQr',14000]]){
      const f=byScreen(page,id);assert.equal(Number(f.getPluginData('sampleAmount')),amount);
      const qr=walk(f).find(n=>n.getPluginData('qrSamplePayload'));assert(qr && qr.svgSource.includes('<path'));assert(qr.getPluginData('qrSamplePayload').includes('KHONG CHUYEN TIEN'));
      const pending=id==='pickupPaymentQr'?'pickupPaymentPending':id.endsWith('Two')?'paymentPendingTwo':'paymentPending';assert.equal(dest(f,pending),byScreen(page,pending));
    }
    assert.equal(dest(byScreen(page,'delivery'),'paymentQr'),byScreen(page,'paymentQr'));
    assert.equal(dest(byScreen(page,'deliveryTwo'),'paymentQrTwo'),byScreen(page,'paymentQrTwo'));
    assert.equal(dest(byScreen(page,'paymentPending'),'paidFuture'),byScreen(page,'paidFuture'));
    assert.equal(dest(byScreen(page,'paymentPendingTwo'),'paidFutureTwo'),byScreen(page,'paidFutureTwo'));
    assert.equal(dest(byScreen(page,'pickupPaymentPending'),'pickupPaidFuture'),byScreen(page,'pickupPaidFuture'));
    assert.equal(dest(byScreen(page,'quick'),'loginQuick'),byScreen(page,'loginQuick'));assert.equal(dest(byScreen(page,'quickTwo'),'loginQuickTwo'),byScreen(page,'loginQuickTwo'));assert.equal(dest(byScreen(page,'loginQuickTwo'),'cartTwo'),byScreen(page,'cartTwo'));assert.equal(dest(byScreen(page,'quickSignedTwo'),'cartTwo'),byScreen(page,'cartTwo'));assert.equal(dest(byScreen(page,'quickSignedTwo'),'deliveryTwo'),byScreen(page,'deliveryTwo'));
    for(const [quantity,suffix] of [[1,''],[2,'Two']])for(const [intent,login,registration,target,label] of [['cart','loginQuick','registerQuick','cart','Thêm vào giỏ'],['checkout','loginBuy','registerBuy','delivery','Mua ngay']]){
      const quick=byScreen(page,'quick'+suffix),action=walk(quick).find(n=>n.name===label);assert(action);assert.equal(action.reactions[0].actions[0].destinationId,byScreen(page,login+suffix).id);
      for(const id of [login,registration]){const f=byScreen(page,id+suffix);assert.equal(f.getPluginData('purchaseIntent'),intent);assert.equal(f.getPluginData('intentQuantity'),String(quantity));assert.equal(dest(f,target+suffix),byScreen(page,target+suffix));assert(!walk(f).some(n=>n.getPluginData('routeTarget').startsWith('quickSigned')),'authentication must not repeat a purchase choice');}
      assert(dest(byScreen(page,login+suffix),registration+suffix));assert(dest(byScreen(page,registration+suffix),login+suffix));
    }
    assert(dest(byScreen(page,'detail'),'loginBuy'));assert(dest(byScreen(page,'detail'),'loginQuick'));assert(dest(byScreen(page,'login'),'account'));assert(dest(byScreen(page,'register'),'account'));
    const carousel=walk(byScreen(page,'home')).find(n=>n.getPluginData('brandCarousel')==='1'),groups=walk(carousel).filter(n=>n.getPluginData('brandGroup'));assert.equal(groups.length,mobile?5:2);for(let i=0;i<groups.length;i++){const arrows=walk(groups[i]).filter(n=>/^Thương hiệu (trước|tiếp theo)$/.test(n.name));assert.equal(arrows.length,2);for(const a of arrows){const next=i+(a.name==='Thương hiệu trước'?-1:1);if(next<0||next>=groups.length)assert.equal(a.getPluginData('disabled'),'1');else assert.equal(a.reactions[0].actions[0].destinationId,groups[next].id);}}
    for(const [id,qr,pending,paid,failed,receipt,total] of [['deliveryDetailTwo','paymentQrTwo','paymentPendingTwo','paidFutureTwo','paymentFailedTwo','paidOrderTwo',53000],['pickupDetailTwo','pickupPaymentQrTwo','pickupPaymentPendingTwo','pickupPaidFutureTwo','pickupPaymentFailedTwo','paidPickupOrderTwo',28000]]){
      assert(dest(byScreen(page,id),qr));assert(dest(byScreen(page,id),'cancelConfirmTwo'));assert(dest(byScreen(page,'cancelConfirmTwo'),'cartTwo'));assert(dest(byScreen(page,qr),id));assert(dest(byScreen(page,qr),pending));assert(dest(byScreen(page,pending),paid));assert(dest(byScreen(page,failed),id));assert(dest(byScreen(page,paid),receipt));assert.equal(Number(byScreen(page,qr).getPluginData('sampleAmount')),total);const summary=walk(byScreen(page,receipt)).find(n=>n.name==='Tổng đơn hàng');assert.equal(+summary.getPluginData('total'),total);
    }
    for(const id of ['paymentExpired','paymentReview'])assert(!walk(byScreen(page,id)).some(n=>n.characters==='39.000 đ'),'generic failure state cannot invent an order total');
    assert.equal(dest(byScreen(page,'login'),'adminLogin'),byScreen(page,'adminLogin'));
    assert.equal(dest(byScreen(page,'adminLogin'),'adminDashboard'),byScreen(page,'adminDashboard'));
    assert.equal(walk(byScreen(page,'home')).filter(n=>n.type==='TEXT'&&n.characters==='Khám phá ngay').length,0);
    for(const title of ['Bán chạy nhất','Sản phẩm mới','Gợi ý cho bạn'])assert(walk(byScreen(page,'home')).some(n=>n.type==='TEXT'&&n.characters===title));
    assert(!walk(byScreen(page,'home')).some(n=>n.type==='TEXT'&&n.characters==='Mua sắm theo danh mục'));
    assert.equal(walk(byScreen(page,'home')).filter(n=>n.getPluginData('productCard')).length,8);
    assert.equal(walk(byScreen(page,'home')).filter(n=>n.getPluginData('bestsellerFlame')==='1').length,1);
    assert.equal(walk(byScreen(page,'home')).filter(n=>n.getPluginData('bestsellerShowcase')==='1').length,1);
    assert.equal(walk(byScreen(page,'home')).filter(n=>n.getPluginData('bestsellerRank')).length,10);const rankViewport=walk(byScreen(page,'home')).find(n=>n.getPluginData('rankViewport')==='1');assert.equal(rankViewport.overflowDirection,'VERTICAL');assert.equal(rankViewport.numberOfFixedChildren,1);assert.equal(rankViewport.children.at(-1).getPluginData('fixedInScroll'),'1');const lastRank=walk(rankViewport).find(n=>n.getPluginData('bestsellerRank')==='10');assert(relativeY(lastRank,rankViewport)>rankViewport.height);const scrollDown=walk(byScreen(page,'home')).find(n=>n.name==='Cuộn tới hạng 10');assert.equal(scrollDown.reactions[0].actions[0].destinationId,lastRank.id);
    if(mobile){const showcase=walk(byScreen(page,'home')).find(n=>n.getPluginData('bestsellerShowcase')==='1');assert(showcase.height<=660,'mobile showcase must not retain the 1068px desktop-style stack');const cover=walk(showcase).find(n=>n.name==='Khung ảnh nổi bật');assert.equal(cover.width,104);assert(walk(showcase).some(n=>n.characters==='Bữa Tối'&&relativeX(n,showcase)>relativeX(cover,showcase)+cover.width),'featured copy sits beside the cover');for(const foot of nodes.filter(n=>n.getPluginData('siteFooter')==='1'))assert(foot.height<=1060,'mobile footer compact');}
    for(const q of walk(page).filter(n=>n.getPluginData('quantityControl')==='1')){assert.equal(q.height,48);const sides=walk(q).filter(n=>['Giảm số lượng','Tăng số lượng'].includes(n.name));assert.equal(sides.length,2);assert(sides.every(n=>n.height===48&&relativeY(n,q)===0&&n.width>=44));}
    for(const foot of walk(page).filter(n=>n.getPluginData('siteFooter')==='1'))assert(!walk(foot).some(n=>n.type==='TEXT'&&n.characters==='THƯƠNG HIỆU'));
    assert(!textLabels.some(s=>/minh họa|để duyệt|bản mẫu|IPN|backend|chưa tích hợp|bổ sung sau/i.test(s)),'technical notes leaked into canvas');
    for(const id of ['paidOrder','paidOrderTwo','paidPickupOrder']){const f=byScreen(page,id);assert(walk(f).some(n=>n.type==='TEXT'&&/Đã thanh toán/.test(n.characters)));assert(!walk(f).some(n=>n.type==='TEXT'&&/Hủy đơn|Chưa thanh toán|Chờ thanh toán/.test(n.characters)));const sum=walk(f).find(n=>n.name==='Tổng đơn hàng');assert.equal(+sum.getPluginData('total'),id==='paidOrderTwo'?53000:id==='paidPickupOrder'?14000:39000);}
    for(const f of screens.filter(f=>f.getPluginData('overlay')!=='1'&&f.getPluginData('screenId')!=='home')){const breadcrumb=walk(f).find(n=>n.name==='Đường dẫn trang');const crumb=walk(breadcrumb).find(n=>n.type==='TEXT'&&n.characters==='Trang chủ');assert(crumb);assert.equal(crumb.reactions[0].actions[0].destinationId,byScreen(page,'home').id);}

    for(const foot of nodes.filter(n=>n.getPluginData('siteFooter')==='1')){
      for(const key of ['storeMap','storeAddress','storePhone','storeHours','scrollTop'])assert.equal(walk(foot).filter(n=>n.getPluginData(key)==='1').length,1,key+' once per footer');
      const map=walk(foot).find(n=>n.getPluginData('storeMap')==='1');assert.equal(map.width,300);assert.equal(map.height,164);
      const up=walk(foot).find(n=>n.getPluginData('scrollTop')==='1');assert.equal(up.width,48);assert.equal(up.height,48);assert.equal(up.reactions[0].actions[0].navigation,'SCROLL_TO');
      assert(!walk(foot).some(n=>/GHÉ NHÀ SÁCH|LIÊN HỆ/.test(n.characters||'')));
    }
    const campaignIds=walk(byScreen(page,'home')).filter(n=>n.getPluginData('campaignId')).map(n=>n.getPluginData('campaignId'));assert.deepEqual(campaignIds,['manga','kids']);
    // New shared footer and QR panels: text rectangles cannot overlap their siblings.
    for(const panel of nodes.filter(n=>n.getPluginData('siteFooter')==='1'||n.name==='Thông tin thanh toán')){
      const texts=panel.children.filter(n=>n.type==='TEXT');
      for(let i=0;i<texts.length;i++)for(let j=i+1;j<texts.length;j++){
        const a=texts[i],b=texts[j];assert(!(a.x<b.x+b.width&&b.x<a.x+a.width&&a.y<b.y+b.height&&b.y<a.y+a.height),'overlapping text: '+a.name+' / '+b.name);
      }
      for(const n of panel.children)assert(n.y>=0&&n.y+n.height<=panel.height+1,'vertical containment '+n.name);
    }
    assert.equal(dest(byScreen(page,'cancelConfirm'),'cart'),byScreen(page,'cart'));
    for(const id of ['paidFuture','paymentFailed','paymentPending','paymentReview']){const f=byScreen(page,id),mark=walk(f).find(n=>n.getPluginData('paymentOutcomeIcon'));assert(mark);assert.equal(mark.width,112);assert(!walk(f).some(n=>n.name==='Chi tiết đơn hàng'));}
    for(const id of ['forgotPassword','resetPassword','adminCategories','adminReconciliation','adminArchive','adminArchived'])assert(byScreen(page,id),id);
    for(const id of ['deliveryDetail','pickupDetail']){assert(dest(byScreen(page,id),'cancelConfirm'));assert(!walk(byScreen(page,id)).some(n=>n.characters==='Cập nhật trạng thái'));}
    for(const foot of nodes.filter(n=>n.getPluginData('siteFooter')==='1'))for(const mark of walk(foot).filter(n=>n.getPluginData('manufacturerBrand')))assert(!walk(mark).some(n=>n.type==='TEXT'),'logos must remain original image assets');
    assert(!walk(byScreen(page,'adminOrderDetail')).some(n=>n.characters==='Đánh dấu đã thanh toán'));
    const adminDetail=byScreen(page,'adminOrderDetail');
    for(const [label,target] of [['Thanh toán qua VNPAY','adminCounterQr'],['Thanh toán tiền mặt','adminCashComplete']]){const action=walk(adminDetail).find(n=>n.name===label&&n.getPluginData('uiRole')==='button');assert(action&&dest(adminDetail,target),'counter collection action '+label);}
    for(const id of ['pickupDetail','pickupDetailTwo']){const f=byScreen(page,id);for(const label of ['Thanh toán ngay','Thanh toán tại quầy','Hủy đơn'])assert(walk(f).some(n=>n.name===label&&n.getPluginData('uiRole')==='button'),label);assert.equal(f.getPluginData('paymentActions'),'3');assert(!walk(f).some(n=>n.name==='Hoạt động đơn hàng'));}
    for(const id of ['deliveryDetail','deliveryDetailTwo']){const f=byScreen(page,id);assert.equal(f.getPluginData('paymentActions'),'2');assert(!walk(f).some(n=>n.name==='Thanh toán tại quầy'));}
    assert(dest(byScreen(page,'pickupDetailTwo'),'ordersPickupTwo'));assert(dest(byScreen(page,'ordersPickupTwo'),'pickupDetailTwo'));
    for(const id of ['adminCounterComplete','adminCashComplete']){const f=byScreen(page,id);assert.equal(f.getPluginData('counterState'),'completed');assert.equal(Number(f.getPluginData('sampleAmount')),14000);assert(walk(f).some(n=>n.characters==='Đơn hàng đã hoàn tất.'));assert(walk(f).some(n=>n.characters==='Nhận tiền thành công'));}
    assert(dest(byScreen(page,'adminCounterQr'),'adminCounterPending'));assert(dest(byScreen(page,'adminCounterPending'),'adminCounterComplete'));assert(!walk(byScreen(page,'adminCounterQr')).some(n=>n.getPluginData('routeTarget')==='adminCashComplete'));
    for(const f of screens)assert.equal(walk(f).filter(n=>n.getPluginData('partnersSection')==='1').length,f.getPluginData('screenId')==='home'?1:0,'partners only landing');
    if(mobile){const nav=walk(byScreen(page,'adminDashboard')).find(n=>n.getPluginData('adminMobileGrid')==='1');assert(nav&&nav.height===248);assert.equal(walk(nav).filter(n=>n.getPluginData('uiRole')==='button').length,8);assert.notEqual(nav.overflowDirection,'HORIZONTAL');}
    if(!mobile){const nav=walk(byScreen(page,'adminDashboard')).find(n=>n.name==='Điều hướng quản trị');const icons=walk(nav).filter(n=>n.getPluginData('iconSource')==='Thu Thanh AdminIcon');assert.equal(icons.length,7);assert.equal(new Set(icons.map(n=>n.svgSource)).size,7);}
    for(const target of ['adminProducts','adminCategories','adminInventory','adminOrders','adminRevenue','adminReconciliation'])assert(dest(byScreen(page,'adminDashboard'),target));
  }
  assert.deepEqual(overflows.slice(0,20),[],`horizontal layout failures: ${overflows.length}`);
  // SVG export mirrors native layers for local browser review; not live Figma evidence.
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  const color=c=>'#'+[c.r,c.g,c.b].map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join('');
  function render(n){
    if(n.visible===false)return '';let content='';const fill=n.fills?.find(p=>p.type==='SOLID'),im=n.fills?.find(p=>p.type==='IMAGE'),stroke=n.strokes?.find(p=>p.type==='SOLID');
    if(n.type!=='TEXT'&&(fill||stroke))content+=`<rect width="${n.width}" height="${n.height}" rx="${typeof n.cornerRadius==='number'?n.cornerRadius:0}" fill="${fill?color(fill.color):'none'}" fill-opacity="${fill?.opacity??1}" ${stroke?`stroke="${color(stroke.color)}"`:''}/>`;
    if(im&&images.has(im.imageHash)){const bytes=images.get(im.imageHash),mime=bytes[0]===137?'image/png':'image/jpeg';content+=`<image width="${n.width}" height="${n.height}" href="data:${mime};base64,${bytes.toString('base64')}" preserveAspectRatio="xMidYMid meet"/>`;}
    if(n.svgSource)content+=`<image width="${n.width}" height="${n.height}" href="data:image/svg+xml;base64,${Buffer.from(n.svgSource).toString('base64')}"/>`;
    if(n.type==='TEXT'){const size=n.fontSize||14,lh=n.lineHeight?.value||size*1.43,max=Math.max(1,Math.floor(n.width/(size*.51))),lines=[];
      for(const para of n.characters.split('\n')){let line='';for(const word of para.split(' ')){if((line+' '+word).trim().length>max&&line){lines.push(line);line=word;}else line=(line+' '+word).trim();}lines.push(line);}
      content+=`<text text-decoration="${n.textDecoration==='STRIKETHROUGH'?'line-through':'none'}" fill="${fill?color(fill.color):'#191c1f'}" font-family="${esc(n.fontName?.family||'Arial')},Arial,sans-serif" font-weight="${/Bold/i.test(n.fontName?.style)?700:400}" font-size="${size}" font-style="${/Italic/i.test(n.fontName?.style)?'italic':'normal'}" letter-spacing="${n.letterSpacing?.value||0}">${lines.slice(0,n.maxLines||lines.length).map((l,i)=>`<tspan x="0" y="${size+i*lh}">${esc(l)}</tspan>`).join('')}</text>`;
    }
    content+=n.children.map(render).join('');if(n.clipsContent){const id='clip'+n.id.replace(':','');content=`<defs><clipPath id="${id}"><rect width="${n.width}" height="${n.height}"/></clipPath></defs><g clip-path="url(#${id})">${content}</g>`;}
    return `<g opacity="${n.opacity??1}" transform="translate(${n.x||0},${n.y||0})">${content}</g>`;
  }
  const preview=path.join(__dirname,'../output/figma/preview');fs.mkdirSync(preview,{recursive:true});
  const previewFont=fs.readFileSync(path.join(__dirname,'../frontend/src/app/fonts/nunito-sans-variable.woff2')).toString('base64');
  for(const page of pages)for(const id of ['pickupDetail','pickupDetailTwo','adminOrderDetail','adminCounterQr','adminCounterPending','adminCounterComplete','adminCashComplete','loginBuy','loginBuyTwo','registerBuy','loginQuick','loginQuickTwo','registerQuick','account','accountSaved','search','newsletterSuccess','quick','quickTwo','quickSigned','quickSignedTwo','home','catalog','detail','cart','delivery','pickup','orders','adminProducts','adminInventory','uiStates','paymentQr','paymentQrTwo','pickupPaymentQr','paymentPending','paymentFailed','paymentExpired','paidFuture','paymentReview','adminLogin','adminDashboard','adminRevenue','paidOrder','paidOrderTwo','paidPickupOrder','ordersPaid']){
    const f=byScreen(page,id),clone=f.clone();clone.x=clone.y=0;clone.height=Number(f.getPluginData('contentHeight'))||f.height;for(const child of [...clone.children])if(child.getPluginData('mobileBottomNav')==='1')child.remove();
    fs.writeFileSync(path.join(preview,(page.name.includes('Điện thoại')?'dien-thoai':'may-tinh')+'-'+id+'.svg'),`<svg xmlns="http://www.w3.org/2000/svg" width="${clone.width}" height="${clone.height}"><defs><style>@font-face{font-family:'Nunito Sans';src:url(data:font/woff2;base64,${previewFont});font-weight:200 900}</style></defs>${render(clone)}</svg>`);clone.remove();
  }
  const landing=root.children.find(p=>p.name==='Landing page');assert(landing);const reviews=landing.children.filter(n=>n.getPluginData('landingReview')==='1');assert.equal(reviews.length,2);assert(reviews[1].x>=reviews[0].width+480);assert(reviews.every(f=>walk(f).every(n=>n.reactions.length===0)),'review page has no cross-page actions');
  const flowManifest=pages.map(page=>({platform:page.name,layout:'flow-rows-max12',flows:page.children.filter(n=>n.getPluginData('layoutLabel')==='1').map(label=>({name:label.characters,screens:page.children.filter(f=>f.getPluginData('screenId')&&f.getPluginData('flowId')===label.getPluginData('flowId')).map(f=>({id:f.getPluginData('screenId'),name:f.name,x:f.x,y:f.y,contentHeight:f.getPluginData('contentHeight')}))}))}));
  flowManifest.unshift({platform:'Landing page',layout:'review-only',screens:reviews.map(f=>({id:f.getPluginData('screenId'),name:f.name,x:f.x,y:f.y,contentHeight:f.getPluginData('contentHeight')}))});
  fs.writeFileSync(path.join(__dirname,'../output/figma/LUONG-THIET-KE.json'),JSON.stringify(flowManifest,null,2));
  for(const [outcome,target] of [['failed','paymentFailed'],['expired','paymentExpired'],['pending','paymentReview'],['review','paymentReview']]){
    messages.length=0;await figma.ui.onmessage({type:'build',paymentOutcome:outcome});assert(!messages.some(m=>m.type==='error'));
    for(const page of pages){const pending=walk(page).find(n=>n.getPluginData('screenId')==='paymentPending');const action=walk(pending).find(n=>n.getPluginData('routeTarget')===target);assert(action&&action.reactions.length,'scenario '+outcome);for(const [pid,fid] of [['paymentPendingTwo','paymentFailedTwo'],['pickupPaymentPending','pickupPaymentFailed']]){const f=walk(page).find(n=>n.getPluginData('screenId')===pid),expected=outcome==='failed'?fid:target;assert(walk(f).some(n=>n.getPluginData('routeTarget')===expected&&n.reactions.length),'channel scenario '+outcome);}}
  }
  await build();
  // A completed build is replaced atomically; manual nodes/images survive and cancel rolls back.
  const photo=walk(pages[0]).find(n=>n.getPluginData('productId')==='TT-SGK-002'&&n.getPluginData('imageSlot')==='1');photo.fills=[{type:'IMAGE',imageHash:'manual-preserved',scaleMode:'FILL'}];
  const ids=pages.flatMap(p=>p.children.filter(n=>n.getPluginData('thuthanhV35')==='1').map(n=>n.id));await build();assert(!manual.removed);assert(pages.every(p=>p.children.filter(n=>n.getPluginData('thuthanhV35')==='1').length===97));assert(ids.every(id=>registry.get(id).removed));
  assert(pages.every(p=>walk(p).filter(n=>n.getPluginData('productId')==='TT-SGK-002'&&n.getPluginData('imageSlot')==='1').every(n=>n.fills[0].imageHash==='manual-preserved'&&n.fills[0].scaleMode==='FIT')));
  await build();assert(pages.every(p=>walk(p).filter(n=>n.getPluginData('productId')==='TT-SGK-002'&&n.getPluginData('imageSlot')==='1').every(n=>n.fills[0].imageHash==='manual-preserved')),'manual image persists through repeated successful rebuilds');
  const landingNote=new Node('TEXT');landingNote.name='Owner note outside plugin';landingNote.resize(300,80);root.children.find(p=>p.name==='Landing page').appendChild(landingNote);
  const masterPhoto=walk(root.children.find(p=>p.name==='Landing page')).find(n=>n.getPluginData('imageSlot')==='1'&&n.getPluginData('productId')==='TT-SGK-002');masterPhoto.fills=[{type:'IMAGE',imageHash:'manual-from-landing',scaleMode:'FIT'}];await build();await build();assert(root.children.filter(p=>p.name==='Landing page'||pages.includes(p)).every(p=>walk(p).filter(n=>n.getPluginData('productId')==='TT-SGK-002'&&n.getPluginData('imageSlot')==='1').every(n=>n.fills[0].imageHash==='manual-from-landing')),'master page photos persist across all 3 pages');assert(!landingNote.removed);assert(root.children.find(p=>p.name==='Landing page').children.filter(n=>n.getPluginData('landingReview')==='1').every(f=>f.x>=landingNote.x+landingNote.width+640),'landing avoids owner notes');
  const ownedAll=()=>root.children.flatMap(p=>p.children.filter(n=>n.getPluginData('thuthanhV35')==='1').map(n=>n.id));const beforeLandingFailure=ownedAll(),setPageBeforeLanding=figma.setCurrentPageAsync;let landingVisits=0;
  figma.setCurrentPageAsync=async function(p){if(p.name==='Landing page'&&++landingVisits===2)throw new Error('Injected landing commit failure');return setPageBeforeLanding.call(this,p);};await figma.ui.onmessage({type:'build'});figma.setCurrentPageAsync=setPageBeforeLanding;assert(messages.some(m=>m.type==='error'&&/landing commit/.test(m.text)));assert.deepEqual(ownedAll(),beforeLandingFailure,'all 3 pages roll back after landing staging failure');
  // Inject a platform transition failure after desktop staging; both old platforms must survive.
  const stableIds=pages.flatMap(p=>p.children.filter(n=>n.getPluginData('thuthanhV35')==='1').map(n=>n.id)),setPage=figma.setCurrentPageAsync;
  figma.setCurrentPageAsync=async function(p){if(p.name.includes('Điện thoại'))throw new Error('Injected platform failure');return setPage.call(this,p);};
  await figma.ui.onmessage({type:'build'});figma.setCurrentPageAsync=setPage;
  assert(messages.some(m=>m.type==='error'&&/Injected platform/.test(m.text)));assert.deepEqual(pages.flatMap(p=>p.children.filter(n=>n.getPluginData('thuthanhV35')==='1').map(n=>n.id)),stableIds);
  for(const priorVersion of [34,26]){
    const priorNodes=root.children.flatMap(p=>p.children.filter(n=>n.getPluginData('thuthanhV35')==='1'));
    for(const n of priorNodes){n.setPluginData('thuthanhV35','');n.setPluginData('thuthanhV'+priorVersion,'1');}
    await build();assert(priorNodes.every(n=>n.removed),'replace managed V'+priorVersion+' without duplicates');assert(!manual.removed);
  }
  assert.equal(root.children.filter(p=>p.type==='PAGE'&&(p.name==='Landing page'||pages.includes(p))).length,3);
  const before=pages.flatMap(p=>p.children.map(n=>n.id));const pending=figma.ui.onmessage({type:'build'});await figma.ui.onmessage({type:'cancel'});await pending;assert(messages.some(m=>m.type==='error'&&/Đã dừng/.test(m.text)));assert.deepEqual(pages.flatMap(p=>p.children.map(n=>n.id)),before);
  const beforeLayoutCancel=ownedAll(),post=figma.ui.postMessage;let cancelledInLayout=false;figma.ui.postMessage=function(m){post(m);if(m.type==='status'&&m.text.startsWith('Auto Layout ')&&!cancelledInLayout){cancelledInLayout=true;figma.ui.onmessage({type:'cancel'});}};await figma.ui.onmessage({type:'build'});figma.ui.postMessage=post;assert(cancelledInLayout);assert.deepEqual(ownedAll(),beforeLayoutCancel,'layout cancellation preserves all pages');
  console.log(JSON.stringify({result:'passed',version:35,complexity,platforms:2,flowsPerPlatform:7,screens:screensTotal+2,prototypeScreens:screensTotal,landingReviewFrames:2,pages:3,routes:routeTotal,productsAudited:24,header:'exact',checks:['dataset hashes','native geometry','money and quantity continuity','overlay close and swap','guest quickview authentication quantity retention','loading-empty-validation-error-expiry-deferred-permission states','correct selected product','4 products per category','first product purchase only','no generated duplicate detail/paging frames','manual preservation including landing review','flow rows max12 and 3 pages','atomic rebuild','platform failure rollback','cancel rollback'],liveFigma:'not_run'}));
})().catch(e=>{console.error(e);process.exitCode=1;});
