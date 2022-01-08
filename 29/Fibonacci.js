import * as THREE from 'three';
import { Vector3 } from 'three';

function pointsOnSphere(n) {
  const pts = [];
  const inc = Math.PI * (3 - Math.sqrt(5));
  const off = 2.0 / n;
  let r;
  var phi;
  let dmin = 10000;
  const prev = new Vector3();
  const cur = new Vector3();

  for (var k = 0; k < n; k++) {
    cur.y = k * off - 1 + off / 2;
    r = Math.sqrt(1 - cur.y * cur.y);
    phi = k * inc;
    cur.x = Math.cos(phi) * r;
    cur.z = Math.sin(phi) * r;

    const dist = cur.distanceTo(prev);
    if (dist < dmin) dmin = dist;

    pts.push(cur.clone());
    prev.copy(cur);
  }

  return pts;
}

function pointsOnPlane(n) {
  const pts = [];
  for (var k = 0; k < n; k++) {
    const pt = new THREE.Vector3(Math.random() * 2 - 1, 0, Math.random() * 2 - 1);
    pts.push(pt);
  }
  return pts;
}

function uvsOnPlane(n) {
  const uvs = [];
  for (var k = 0; k < n; k++) {
    const uv = new THREE.Vector2(Math.random(), 0, Math.random());
    uvs.push(uv);
  }
  return uvs;
}

export { pointsOnSphere, pointsOnPlane, uvsOnPlane };
