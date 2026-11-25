import * as THREE from 'three';

const host = document.querySelector('#canvas-host');
const loading = document.querySelector('#loading');
const errorMessage = document.querySelector('#error');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

try { startBouquet(); }
catch (error) {
  console.error('Unable to initialize the bouquet scene:', error);
  loading.hidden = true;
  errorMessage.hidden = false;
}

function startBouquet() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0, 4.3, 12.8);
  camera.lookAt(0, 2.2, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.setClearColor(0x000000, 0);
  host.appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xf8d9c2, 0x152319, 1.8));
  const key = new THREE.DirectionalLight(0xffe5cb, 3.1); key.position.set(-3, 8, 6); scene.add(key);
  const rim = new THREE.PointLight(0xc875a7, 32, 13, 2); rim.position.set(3, 5, -2); scene.add(rim);
  const warm = new THREE.PointLight(0xf0b878, 18, 10, 2); warm.position.set(-4, 2.5, 3); scene.add(warm);

  const bouquet = new THREE.Group(); scene.add(bouquet);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(4, 64), new THREE.MeshBasicMaterial({ color: 0x0c0c0e, transparent: true, opacity: .56 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -.045; scene.add(ground);
  const flowerSpecs = [
    {x:-1.38,z:.28,h:2.88,color:0xe64c62,petals:9,seed:1},
    {x:-.72,z:-.38,h:3.6,color:0xf5b4c4,petals:10,seed:2},
    {x:0,z:.38,h:3.96,color:0xffd35d,petals:12,seed:3},
    {x:.76,z:-.25,h:3.55,color:0xf4ecda,petals:11,seed:4},
    {x:1.42,z:.28,h:2.93,color:0xb48be8,petals:10,seed:5},
    {x:-.35,z:.95,h:2.82,color:0xff8297,petals:9,seed:6},
    {x:.55,z:.95,h:2.9,color:0xe95c73,petals:10,seed:7}
  ];
  const flowers = flowerSpecs.map((spec, index) => createFlower(spec, index));
  const wrap = createWrap(); bouquet.add(wrap);
  const particles = createParticles(); bouquet.add(particles);

  let yaw = 0, pitch = 0, drag = null;
  host.addEventListener('pointerdown', event => {
    drag = { x: event.clientX, y: event.clientY, yaw, pitch, id: event.pointerId };
    host.setPointerCapture(event.pointerId);
  });
  host.addEventListener('pointermove', event => {
    if (!drag || drag.id !== event.pointerId) return;
    yaw = drag.yaw + (event.clientX - drag.x) * .008;
    pitch = THREE.MathUtils.clamp(drag.pitch + (event.clientY - drag.y) * .005, -.24, .24);
  });
  const stopDrag = event => { if (drag && drag.id === event.pointerId) drag = null; };
  host.addEventListener('pointerup', stopDrag); host.addEventListener('pointercancel', stopDrag);

  const replay = document.querySelector('#replay');
  const bloomAll = document.querySelector('#bloom-all');
  const reset = document.querySelector('#reset');
  let startTime = performance.now() / 1000;
  let animationOffset = 0;
  let forceBloomAt = -1;
  let stopped = false;

  function replayAnimation() { animationOffset = performance.now() / 1000; forceBloomAt = -1; }
  replay.addEventListener('click', replayAnimation);
  bloomAll.addEventListener('click', () => { forceBloomAt = performance.now() / 1000; });
  reset.addEventListener('click', () => { yaw = 0; pitch = 0; replayAnimation(); });

  const clock = new THREE.Clock();
  function resize() {
    const bounds = host.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    renderer.setSize(bounds.width, bounds.height, false);
    camera.aspect = bounds.width / bounds.height;
    camera.position.z = bounds.width < 520 ? 14.4 : 12.8;
    camera.updateProjectionMatrix();
  }
  const observer = new ResizeObserver(resize); observer.observe(host); resize();

  function frame() {
    if (stopped) return;
    requestAnimationFrame(frame);
    const now = performance.now() / 1000;
    const elapsed = now - (animationOffset || startTime);
    const forceAge = forceBloomAt < 0 ? 0 : now - forceBloomAt;
    bouquet.rotation.y += (yaw - bouquet.rotation.y) * .075;
    bouquet.rotation.x += (pitch - bouquet.rotation.x) * .075;
    flowers.forEach(flower => updateFlower(flower, elapsed, forceAge, now));
    particles.rotation.y = now * .035;
    particles.children.forEach((particle, i) => {
      particle.material.opacity = .28 + .62 * (.5 + .5 * Math.sin(now * (1.15 + (i % 5) * .13) + particle.userData.phase));
      particle.position.y = particle.userData.baseY + Math.sin(now * .55 + particle.userData.phase) * .055;
    });
    renderer.render(scene, camera);
  }
  loading.hidden = true;
  if (reducedMotion) { flowers.forEach(f => { f.stem.scale.y = 1; f.head.scale.setScalar(1); }); }
  requestAnimationFrame(frame);
  addEventListener('pagehide', () => { stopped = true; observer.disconnect(); renderer.dispose(); }, { once: true });

  function createFlower(spec, index) {
    const root = new THREE.Group();
    root.position.set(spec.x, 0, spec.z); bouquet.add(root);
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0,0,0), new THREE.Vector3(-spec.x*.16,spec.h*.52,0), new THREE.Vector3(0,spec.h,0));
    const stem = new THREE.Mesh(new THREE.TubeGeometry(curve, 18, .042, 7, false), new THREE.MeshStandardMaterial({ color: 0x548957, roughness: .78 }));
    stem.scale.y = reducedMotion ? 1 : .001; root.add(stem);
    for (let j=0;j<4;j++) {
      const t=.24+j*.135, point=curve.getPoint(t), tangent=curve.getTangent(t);
      const leaf=new THREE.Mesh(makeLeafGeometry(.37,.105),new THREE.MeshStandardMaterial({color:j%2?0x6eaa69:0x4f8a59,roughness:.72,side:THREE.DoubleSide}));
      leaf.position.copy(point); leaf.rotation.y=(j%2?1:-1)*(1.0+j*.18); leaf.rotation.x=-.1; leaf.scale.setScalar(.001); root.add(leaf);
      stem.userData.leaves ||= []; stem.userData.leaves.push({mesh:leaf,at:t});
    }
    const head = new THREE.Group(); head.position.set(0,spec.h,0); root.add(head);
    const petalMaterial=new THREE.MeshStandardMaterial({color:spec.color,roughness:.39,metalness:.025,side:THREE.DoubleSide,emissive:spec.color,emissiveIntensity:.065});
    const petalGroup=new THREE.Group(); head.add(petalGroup);
    // Four overlapping whorls make a rose silhouette, with the innermost petals
    // standing more upright around a small, mostly hidden heart.
    const roseWhorls=[
      {count:spec.petals,length:.78,width:.30,base:.015,tilt:-.30},
      {count:Math.max(7,spec.petals-2),length:.61,width:.27,base:.105,tilt:-.48},
      {count:7,length:.43,width:.235,base:.17,tilt:-.70},
      {count:5,length:.29,width:.19,base:.205,tilt:-.88}
    ];
    roseWhorls.forEach((whorl,ring)=>{
      for(let i=0;i<whorl.count;i++){
        const petal=new THREE.Mesh(makePetalGeometry(whorl.length,whorl.width,whorl.base),petalMaterial);
        petal.rotation.y=(i/whorl.count)*Math.PI*2+(ring%2)*Math.PI/whorl.count;
        petal.rotation.x=whorl.tilt;
        petal.rotation.z=-.12;
        petalGroup.add(petal);
      }
    });
    const center=new THREE.Mesh(new THREE.SphereGeometry(.095,18,12),new THREE.MeshStandardMaterial({color:spec.color,roughness:.48})); center.scale.set(1,.8,1); center.position.y=.09; head.add(center);
    const seeds=new THREE.Group(); head.add(seeds);
    const bud=new THREE.Mesh(new THREE.SphereGeometry(.19,12,10),new THREE.MeshStandardMaterial({color:spec.color,roughness:.5})); bud.position.y=.08; bud.scale.set(.8,1.45,.8); head.add(bud);
    const calyx=new THREE.Mesh(new THREE.ConeGeometry(.22,.32,7),new THREE.MeshStandardMaterial({color:0x598852,roughness:.8})); calyx.position.y=-.12; calyx.rotation.x=Math.PI; head.add(calyx);
    petalGroup.scale.setScalar(.001); center.scale.setScalar(.001); seeds.scale.setScalar(.001); bud.visible=true;
    head.scale.setScalar(reducedMotion?1:.001);
    return {spec,index,root,stem,head,petalGroup,center,seeds,bud,phase:index*.58,flourish:Math.random()*6.28};
  }
}

function updateFlower(flower, elapsed, forceAge, now) {
  const {spec,index,stem,head,petalGroup,center,seeds,bud}=flower;
  const growthStart=index*.31;
  const stemProgress=THREE.MathUtils.smoothstep(elapsed-growthStart,0,1.8);
  stem.scale.y=Math.max(.001,stemProgress);
  stem.userData.leaves?.forEach(({mesh,at})=>{const p=THREE.MathUtils.smoothstep(stemProgress,at-.08,at+.16);mesh.scale.set(.001,.001,.001);mesh.scale.set(.7*p,p,p);});
  const bloomStart=1.35+index*.48;
  const normalBloom=THREE.MathUtils.smoothstep(elapsed-bloomStart,0,1.6);
  const bloom=forceAge>0?Math.max(normalBloom,THREE.MathUtils.smoothstep(forceAge-index*.07,0,.95)):normalBloom;
  head.scale.setScalar(Math.max(.001,stemProgress));
  const petalEase=bloom*bloom*(3-2*bloom);
  petalGroup.scale.set(petalEase,petalEase,petalEase);
  center.scale.set(petalEase,petalEase*.44,petalEase);
  seeds.scale.setScalar(petalEase);
  bud.visible=bloom<.88;
  if(bud.visible){const open=THREE.MathUtils.smoothstep(bloom,0,.86);bud.scale.set(.8*(1-open*.65),1.45*(1-open*.72),.8*(1-open*.65));bud.rotation.z=Math.sin(now*.5+flower.phase)*.045;}
  head.rotation.z=Math.sin(now*.55+flower.phase)*.025;
  petalGroup.rotation.y=now*.035+flower.phase*.1;
}

function makePetalGeometry(length,width,base=0){
  const positions=[],indices=[],segments=12,across=8;
  for(let i=0;i<=segments;i++){const t=i/segments,spread=Math.pow(Math.sin(Math.PI*t),.72)*width*(.54+.46*t);for(let j=0;j<=across;j++){const u=j/across*2-1;const curl=Math.pow(Math.abs(u),1.7)*Math.pow(t,.8)*.12;positions.push(u*spread,Math.sin(t*Math.PI)*.055+curl,length*t+base);}}
  for(let i=0;i<segments;i++)for(let j=0;j<across;j++){const a=i*(across+1)+j,b=a+across+1;indices.push(a,b,a+1,b,b+1,a+1);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
function makeLeafGeometry(length,width){
  const p=[],idx=[],n=12;for(let i=0;i<=n;i++){const t=i/n,w=Math.sin(Math.PI*t)*width;for(const side of [-1,1])p.push(side*w,Math.sin(t*Math.PI)*.035,length*t);}
  for(let i=0;i<n;i++){const a=i*2;idx.push(a,a+1,a+2,a+1,a+3,a+2);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(idx);g.computeVertexNormals();return g;
}
function createWrap(){
  const group=new THREE.Group();
  const paper=new THREE.Mesh(new THREE.CylinderGeometry(.37,.94,1.35,9,1,true),new THREE.MeshStandardMaterial({color:0x674c4b,roughness:.82,side:THREE.DoubleSide}));paper.position.set(0,.65,0);paper.rotation.y=.18;group.add(paper);
  const fold=new THREE.Mesh(new THREE.CylinderGeometry(.39,.96,.12,9,1,true),new THREE.MeshStandardMaterial({color:0x9a6e69,roughness:.76,side:THREE.DoubleSide}));fold.position.set(0,.43,0);fold.rotation.y=.18;group.add(fold);
  const band=new THREE.Mesh(new THREE.TorusGeometry(.53,.035,8,32),new THREE.MeshStandardMaterial({color:0xc9a166,metalness:.28,roughness:.46}));band.position.y=.73;band.rotation.x=Math.PI/2;group.add(band);
  return group;
}
function createParticles(){
  const group=new THREE.Group(),material=new THREE.MeshBasicMaterial({color:0xffd89b,transparent:true,opacity:.7});
  for(let i=0;i<34;i++){const a=i*2.399,r=.85+(i%7)*.24,y=.75+(i%11)*.29;const m=new THREE.Mesh(new THREE.SphereGeometry(i%5===0?.026:.014,6,5),material.clone());m.position.set(Math.cos(a)*r,y,Math.sin(a)*r);m.userData.phase=i*1.71;m.userData.baseY=y;group.add(m);}return group;
}
