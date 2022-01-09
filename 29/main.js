import {
  scene,
  controls,
  renderer,
  addUpdate,
  addResize,
  resize,
  camera,
} from "../modules/renderer.js";
import {
  MeshNormalMaterial,
  Object3D,
  InstancedMesh,
  InstancedBufferGeometry,
  PlaneBufferGeometry,
  Vector3,
  Vector2,
  Quaternion,
  Matrix4,
  Mesh,
  IcosahedronBufferGeometry,
  MeshBasicMaterial,
  DataTexture,
  RGBFormat,
  RGBAFormat,
  FloatType,
  ClampToEdgeWrapping,
  RepeatWrapping,
  NearestFilter,
  DoubleSide,
  Raycaster,
  InstancedBufferAttribute,
  CanvasTexture,
  EdgesHelper,
  MeshStandardMaterial,
  ShaderMaterial,
  TextureLoader,
  LinearFilter,
} from 'three';
import * as THREE from 'three';
// import { Poisson3D } from "./poisson.js";
import { GrassMaterial } from "./GrassMaterial.js";
import { nextPowerOfTwo, randomInRange, VERSION } from "../modules/Maf.js";
import { pointsOnPlane } from "./Fibonacci.js";
import { perlin3 } from "../third_party/perlin.js";
import { CurlPass } from "./CurlPass.js";
import { Post } from "./post.js";
// import { capture } from "../modules/capture.js";

const post = new Post(renderer);

// blade geometry

const material = new GrassMaterial({ wireframe: !true });

// opaque interior

const size = 4;
const sphere = new Mesh(
  new IcosahedronBufferGeometry(1, 10),
  new MeshBasicMaterial({ color: 0, side: DoubleSide })
);
// scene.add(sphere);

const scale = 6;
const textureLoader = new TextureLoader();
const plane = new Mesh(
  new PlaneBufferGeometry(size * scale, size * scale, 1, 1)
    .applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI / 2)),
  new ShaderMaterial({
    vertexShader: `\
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `\
      uniform sampler2D colorTexture;
      uniform sampler2D heightTexture;
      varying vec2 vUv;
      const vec3 baseColor = vec3(${new THREE.Color(75./255, 112./255, 34./255).multiplyScalar(1).toArray().join(', ')});
      void main() {
        vec3 height = texture2D(colorTexture, vUv).rgb;
        float h = (height.r + height.g + height.b) / 3.0;
        gl_FragColor = vec4(baseColor * h, 1.0);
      }
    `,
    uniforms: {
      colorTexture: {
        value: textureLoader.load('https://webaverse.github.io/codevember-2021/29/Vol_39_5_Base_Color.png'),
      },
      heightTexture: {
        value: textureLoader.load('https://webaverse.github.io/codevember-2021/29/Vol_39_5_Height.png'),
      },
    },
    // emissive: new THREE.Color(75./255, 112./255, 34./255).multiplyScalar(0.35).getHex(),
    // emissive: 0xffffff,
    // emissiveMap: textureLoader.load('/codevember-2021/29/Vol_39_5_Base_Color.png'),
    side: DoubleSide,
  }),
);
plane.material.uniforms.colorTexture.value.wrapS = RepeatWrapping;
plane.material.uniforms.colorTexture.value.wrapT = RepeatWrapping;
plane.material.uniforms.heightTexture.value.wrapS = RepeatWrapping;
plane.material.uniforms.heightTexture.value.wrapT = RepeatWrapping;
for (let i = 0; i < plane.geometry.attributes.uv.count; i++) {
  plane.geometry.attributes.uv.array[i * 2 + 0] *= 50;
  plane.geometry.attributes.uv.array[i * 2 + 1] *= 50;
}
scene.add(plane);

function generateDistortFn() {
  const a = randomInRange(-1000, 1000);
  const b = randomInRange(-1000, 1000);
  const c = randomInRange(-1000, 1000);
  const radius = randomInRange(0.5, 1);
  return (p) => {
    p.multiplyScalar(2 + radius * perlin3(p.x + a, p.y + b, p.z + c));
  };
}

let curlPass;

function orthogonal(v) {
  if (Math.abs(v.x) > Math.abs(v.z)) {
    return new Vector3(-v.y, v.x, 0).normalize();
  }
  return new Vector3(0.0, -v.z, v.y).normalize();
}

const up = new Vector3(0, 1, 0);
const down = new Vector3(0, -1, 0);

function calcNormal(p, fn, n) {
  const normal = p.normalize();
  //const dPos = p.clone();
  // fn(dPos);

  const tangent = new Vector3().crossVectors(normal, up);
  // fn(tangent)
  const binormal = new Vector3().crossVectors(normal, tangent);
  // fn(binormal);

  const offset = 0.5;
  const a = new Vector3().copy(p).add(tangent.clone().multiplyScalar(offset));
  const b = new Vector3().copy(p).add(binormal.clone().multiplyScalar(offset));

  fn(a);
  fn(b);

  const dT = a.sub(p);
  const dB = b.sub(p);
  // dT.crossVectors(dT, dB);

  n.crossVectors(dT, dB).normalize();
  // fn(n);
  /* n.x *= 0.3;
  n.z *= 0.3;
  n.normalize(); */
  // if (n.y < 0) {
    // n.y = Math.abs(n.y);
    // n.x *= -1;
    // n.z *= -1;
    // n.multiplyScalar(-1);
  // }
}

let mesh;
let numPoints = 100000;
// let numPoints = 300000;

/* let updateFn = null;
addUpdate(() => {
  updateFn && updateFn();
}); */

function distributeGrass() {
  // const width = Math.ceil(Math.sqrt(points.length));
  // const height = Math.ceil(points.length / width);
  const width = nextPowerOfTwo(Math.sqrt(numPoints));
  const height = Math.ceil(numPoints / width);

  const distort = generateDistortFn();

  /* const tmp = new Vector3();
  const sphereVertices = sphere.geometry.attributes.position.array;
  for (let i = 0; i < sphereVertices.length; i += 3) {
    tmp.set(sphereVertices[i], sphereVertices[i + 1], sphereVertices[i + 2]);
    tmp.normalize();
    // distort(tmp);
    sphereVertices[i] = tmp.x;
    sphereVertices[i + 1] = tmp.y;
    sphereVertices[i + 2] = tmp.z;
  }
  sphere.geometry.attributes.position.needsUpdate = true; */

  // const poisson = new Poisson3D(1, 1, 1, 0.01, 30);
  // const points = poisson.calculate();
  const points = pointsOnPlane(numPoints);
  for (const pt of points) {
    pt.multiplyScalar(size/2);
  }

  if (mesh) {
    scene.remove(mesh);
    mesh = null;
  }
  const geometry = new InstancedBufferGeometry().copy(new PlaneBufferGeometry(0.02, 1, 2, 10));
  const trans = new Matrix4().makeTranslation(0, -0.5, 0);
  geometry.applyMatrix4(trans);
  const rot = new Matrix4().makeRotationX(-Math.PI / 2);
  geometry.applyMatrix4(rot);
  const vertices = geometry.attributes.position.array;
  for (let i = 0; i < vertices.length; i += 3) {
    if (vertices[i + 0] === 0) {
      // const z = vertices[i + 2];
      // vertices[i + 1] = 0.005;
    }
  }
  mesh = new InstancedMesh(geometry, material, points.length);
  mesh.castShadow = mesh.receiveShadow = true;
  scene.add(mesh);

  // const offsetData = new Float32Array(width * height * 3);
  const offsetData2 = new Float32Array(width * height * 3);
  const quaternionData = new Float32Array(width * height * 4);
  const quaternionData2 = new Float32Array(width * height * 4);
  // const scaleData = new Float32Array(width * height * 3);
  const curlData = new Float32Array(width * height * 3);

  const t = new Vector3();
  const n = new Vector3();
  const n2 = new Vector3();
  const dummy = new Object3D();
  const localVector = new Vector3();
  const localVector2 = new Vector3();
  const localVector3 = new Vector3();
  const localVector4 = new Vector3();
  const localQuaternion = new Quaternion();

  const rotation = 0.3; // randomInRange(0, 1);

  const mainOffset = localVector.set((Math.random() * 2 - 1), 0, (Math.random() * 2 - 1))
    .normalize()
    .multiplyScalar(Math.sqrt(2 * size / 2));
  const normalFactor = 0.1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = localVector2.set(-size/2 + x * size / width, 0, size/2 - y * size / height);
      // p.multiplyScalar(0.5);
      const mainP = localVector3.copy(p);
      
      t.copy(p);
      dummy.position.copy(p);
      dummy.scale.set(1, 1, 0.1);
      t.add(mainOffset);
      calcNormal(t, distort, n);
      n.lerp(up, normalFactor);
      t.copy(p).add(n);
      dummy.up.set(0, 0, 1);
      dummy.lookAt(t);
      const baseQuaternion = localQuaternion.copy(dummy.quaternion);
      const ang = randomInRange(-rotation, rotation);
      dummy.rotateOnAxis(n, ang);
      dummy.position.sub(mainP);

      // compute the index into the data texture array
      const index = y * width + x;
      dummy.position.toArray(offsetData2, index * 3);
      baseQuaternion.toArray(quaternionData, index * 4);
      n.toArray(quaternionData2, index * 4);
      quaternionData2[index * 4 + 3] = ang;
      
      // mainP.multiplyScalar(2);
      mainP.toArray(curlData, index * 3);
    }
  }
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    mesh.setColorAt(
      i,
      new Vector3(i, p.x, p.z)
    );
  }
  window.points = points;

  mesh.instanceMatrix.needsUpdate = true;
  mesh.instanceColor.needsUpdate = true;

  /* const offsetTexture = new DataTexture(
    offsetData,
    width,
    height,
    RGBFormat,
    FloatType,
    undefined,
    RepeatWrapping,
    RepeatWrapping,
    NearestFilter,
    NearestFilter,
  );
  material.uniforms.offsetTexture.value = offsetTexture; */
  
  const offsetTexture2 = new DataTexture(
    offsetData2,
    width,
    height,
    RGBFormat,
    FloatType,
    undefined,
    RepeatWrapping,
    RepeatWrapping,
    LinearFilter,
    LinearFilter,
  );
  material.uniforms.offsetTexture2.value = offsetTexture2;

  const quaternionTexture = new DataTexture(
    quaternionData,
    width,
    height,
    RGBAFormat,
    FloatType,
    undefined,
    RepeatWrapping,
    RepeatWrapping,
    LinearFilter,
    LinearFilter,
  );
  material.uniforms.quaternionTexture.value = quaternionTexture;

  const quaternionTexture2 = new DataTexture(
    quaternionData2,
    width,
    height,
    RGBAFormat,
    FloatType,
    undefined,
    RepeatWrapping,
    RepeatWrapping,
    LinearFilter,
    LinearFilter,
  );
  material.uniforms.quaternionTexture2.value = quaternionTexture2;

  /* const scaleTexture = new DataTexture(
    scaleData,
    width,
    height,
    RGBFormat,
    FloatType,
    undefined,
    RepeatWrapping,
    RepeatWrapping,
    NearestFilter,
    NearestFilter,
  );
  material.uniforms.scaleTexture.value = scaleTexture; */

  curlPass = new CurlPass(
    renderer,
    new DataTexture(
      curlData,
      width,
      height,
      RGBFormat,
      FloatType,
      undefined,
      RepeatWrapping,
      RepeatWrapping,
      LinearFilter,
      LinearFilter
    ),
    width,
    height
  );
  material.uniforms.curlMap.value = curlPass.texture;

  curlPass.shader.uniforms.persistence.value = 1; // randomInRange(1, 1.5);
  curlPass.shader.uniforms.speed.value = 1; // randomInRange(1, 2);

  /* updateFn = () => {
    controls.
  }; */
}

distributeGrass();

function randomize() {
  distributeGrass();
}

let running = true;

window.addEventListener("keydown", (e) => {
  if (e.code === "KeyR") {
    randomize();
  }
  if (e.code === "Space") {
    running = !running;
  }
});

/* function setQuality(num) {
  scene.remove(mesh);
  mesh.geometry.dispose();
  mesh = null;
  numPoints = num;
  curlPass = null;
  randomize();
}
document.querySelector("#low").addEventListener("click", (e) => {
  setQuality(50000);
});

document.querySelector("#medium").addEventListener("click", (e) => {
  setQuality(100000);
});

document.querySelector("#high").addEventListener("click", (e) => {
  setQuality(300000);
});

document.querySelector("#pauseBtn").addEventListener("click", (e) => {
  running = !running;
});

document.querySelector("#randomizeBtn").addEventListener("click", (e) => {
  randomize();
}); */

const raycaster = new Raycaster();
const mouse = new Vector2();
function onMouseMove(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
}
renderer.domElement.addEventListener("pointermove", onMouseMove, false);
renderer.domElement.addEventListener("pointerdown", onMouseMove, false);

let time = 0;
let prevTime = performance.now();

const boulder = new Mesh(
  new IcosahedronBufferGeometry(0.1, 10),
  new MeshBasicMaterial({ color: 0 })
);
// scene.add(boulder);

let frames = 0;

const point = new Vector3();

function render() {
  const t = performance.now();
  const dt = (t - prevTime) / 1000;
  prevTime = t;

  // controls.autoRotate = true;
  // controls.rotateSpeed = 0.1;
  // controls.update();

  // mouse.x = 0.5 * Math.cos(time);
  // mouse.y = 0.5 * Math.sin(0.9 * time);
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(plane);

  if (intersects.length) {
    point.copy(intersects[0].point)
      .divideScalar(scale);
    boulder.position.copy(point);
  }

  if (running) {
    time += dt;
  }

  if (curlPass && running) {
    curlPass.shader.uniforms.time.value = time / 10;
    curlPass.render();
  }

  material.uniforms.boulder.value.copy(boulder.position);
  material.uniforms.time.value = time / 10;
  material.uniforms.scale.value = scale;
  material.uniforms.size.value = size;

  material.uniforms.direction.value.set(0, 0, -1)
    // .add(camera.up)
    .normalize()
    .applyQuaternion(camera.quaternion);
  material.uniforms.direction.value.y = 0;
  material.uniforms.direction.value.normalize();
  if (material.uniforms.direction.value.length() < 0.01) {
    material.uniforms.direction.value.copy(camera.up)
      .applyQuaternion(camera.quaternion);
    material.uniforms.direction.value.y = 0;
    material.uniforms.direction.value.normalize();
  }

  material.uniforms.cameraTarget.value.copy(controls.target);
  plane.position.set(controls.target.x, 0, controls.target.z);
  plane.updateMatrixWorld();

  post.render(scene, camera);
  // renderer.render(scene, camera);
  

  // frames++;
  // if (frames > 240) {
  //   frames = 0;
  //   randomize();
  // }
  // capture(renderer.domElement);

  renderer.setAnimationLoop(render);
}

function myResize(w, h) {
  post.setSize(w, h);
}
addResize(myResize);

renderer.setClearColor(0x101010, 1);
resize();
render();

// window.start = () => {
//   frames = 0;
//   capturer.start();
// };
