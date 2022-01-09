import {
  RawShaderMaterial,
  GLSL3,
  TextureLoader,
  DoubleSide,
  Vector2,
  Vector3,
} from 'three';
// import { ShaderPass } from "../modules/ShaderPass.js";

const loader = new TextureLoader();
const blade = loader.load("../assets/blade.jpg");

const vertexShader = `precision highp float;

in vec3 position;
in vec3 normal;
in vec2 uv;
// in mat4 instanceMatrix;
in vec3 instanceColor;
// in vec3 offset;

uniform float scale;
uniform vec3 cameraTarget;
uniform vec3 direction;
uniform mat3 normalMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform sampler2D offsetTexture;
uniform sampler2D offsetTexture2;
uniform sampler2D quaternionTexture;
uniform sampler2D quaternionTexture2;
uniform sampler2D scaleTexture;

uniform mat4 modelMatrix;

uniform float time;
uniform sampler2D curlMap;
uniform vec3 boulder;

out vec3 vNormal;
out vec2 vUv;
out float vDry;
out float vLight;

#define PI 3.1415926535897932384626433832795
// const float pos_infinity = uintBitsToFloat(0x7F800000);
// const float neg_infinity = uintBitsToFloat(0xFF800000);

float inCubic(in float t) {
  return t * t * t;
}

float outCubic(in float t ) {
  return --t * t * t + 1.;
}

vec3 applyVectorQuaternion(vec3 vec, vec4 quat) {
  return vec + 2.0 * cross( cross( vec, quat.xyz ) + quat.w * vec, quat.xyz );
}

mat4 rotationMatrix(vec3 axis, float angle) {
  axis = normalize(axis);
  float s = sin(angle);
  float c = cos(angle);
  float oc = 1.0 - c;
  
  return mat4(oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,  0.0,
              oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,  0.0,
              oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c,           0.0,
              0.0,                                0.0,                                0.0,                                1.0);
}

vec3 rotateVectorAxisAngle(vec3 v, vec3 axis, float angle) {
  mat4 m = rotationMatrix(axis, angle);
  return (m * vec4(v, 1.0)).xyz;
}

// this function applies modulo to a vector to keep it within a min/max range
vec3 modXZ(vec3 minBound, vec3 maxBound, vec3 p) {
  vec2 size = maxBound.xz - minBound.xz;
  vec2 res = mod(p.xz - minBound.xz, size) + minBound.xz;
  return vec3(res.x, p.y, res.y);
}

mat4 compose(vec3 position, vec4 quaternion, vec3 scale) {
  mat4 te = mat4(1.);

  float x = quaternion.x, y = quaternion.y, z = quaternion.z, w = quaternion.w;
  float x2 = x + x,	y2 = y + y, z2 = z + z;
  float xx = x * x2, xy = x * y2, xz = x * z2;
  float yy = y * y2, yz = y * z2, zz = z * z2;
  float wx = w * x2, wy = w * y2, wz = w * z2;

  float sx = scale.x, sy = scale.y, sz = scale.z;

  te[ 0 ][0] = ( 1. - ( yy + zz ) ) * sx;
  te[ 1 ][1] = ( xy + wz ) * sx;
  te[ 2 ][2] = ( xz - wy ) * sx;
  te[ 3 ][3] = 0.;

  te[ 1 ][0] = ( xy - wz ) * sy;
  te[ 1 ][1] = ( 1. - ( xx + zz ) ) * sy;
  te[ 1 ][2] = ( yz + wx ) * sy;
  te[ 1 ][3] = 0.;

  te[ 2 ][0] = ( xz + wy ) * sz;
  te[ 2 ][1] = ( yz - wx ) * sz;
  te[ 2 ][2] = ( 1. - ( xx + yy ) ) * sz;
  te[ 2 ][3] = 0.;

  te[ 3 ][0] = position.x;
  te[ 3 ][1] = position.y;
  te[ 3 ][2] = position.z;
  te[ 3 ][3] = 1.;

  return te;
}
vec4 getQuaternionFromAxisAngle(vec3 axis, float angle) {
  vec4 q = vec4(0.);

  // http://www.euclideanspace.com/maths/geometry/rotations/conversions/angleToQuaternion/index.htm

  // assumes axis is normalized

  float halfAngle = angle / 2., s = sin(halfAngle);

  q.x = axis.x * s;
  q.y = axis.y * s;
  q.z = axis.z * s;
  q.w = cos(halfAngle);
  
  return q;
}
vec4 multiplyQuaternions(vec4 a, vec4 b) {
  vec4 q = vec4(0.);
  
  float qax = a.x, qay = a.y, qaz = a.z, qaw = a.w;
  float qbx = b.x, qby = b.y, qbz = b.z, qbw = b.w;

  q.x = qax * qbw + qaw * qbx + qay * qbz - qaz * qby;
  q.y = qay * qbw + qaw * qby + qaz * qbx - qax * qbz;
  q.z = qaz * qbw + qaw * qbz + qax * qby - qay * qbx;
  q.w = qaw * qbw - qax * qbx - qay * qby - qaz * qbz;
  
  return q;
}

const float bladeLength = 0.1;
const float cover = .25;
void main() {
  float id = float(int(instanceColor.x));
  vec2 curlTSize = vec2(textureSize(curlMap, 0));
  vec2 curlUv = vec2(mod(id + 0.5, curlTSize.x)/(curlTSize.x), ((id + 0.5)/curlTSize.x)/(curlTSize.y));
  
  vec4 curlV = texture(curlMap, curlUv);
  vec3 offset = texture(offsetTexture, curlUv).rgb;
  // vec3 offset = vec3(instanceMatrix[0][3], instanceMatrix[1][3], instanceMatrix[2][3]);
  vec3 positionV = texture(offsetTexture2, curlUv).rgb;
  vec4 quaternionV1 = texture(quaternionTexture, curlUv).rgba;
  vec4 axisAngleV = texture(quaternionTexture2, curlUv).rgba;
  vec4 quaternionV2 = getQuaternionFromAxisAngle(axisAngleV.rgb, axisAngleV.a);
  vec4 quaternionV = multiplyQuaternions(quaternionV1, quaternionV2);
  // vec3 scaleV = texture(scaleTexture, curlUv).rgb;
  vec3 scaleV = vec3(1., 1., bladeLength);
  mat4 instanceMatrix2 = compose(positionV, quaternionV, scaleV);

  // base position
  vUv = vec2(uv.x, 1.-uv.y);
  vec3 base = (instanceMatrix2 * vec4(position.xy, 0., 1.)).xyz + offset;
  vec3 dBoulder = (boulder-base);
  vLight = (1./length(dBoulder))/5.;
  vLight = pow(vLight, 2.);
  if(length(dBoulder)>cover) {
    dBoulder = vec3(0.);
  }

  // curl
  vec3 n = curlV.xyz;
  float h = (1.+ curlV.a);
  float l = length(dBoulder) > 0. ? (length(dBoulder)/cover) : 0.;
  vec3 pNormal = (transpose(inverse(modelMatrix)) * vec4(normalize(vec3(.01 * n.xy, 1.)), 1.)).xyz;
  // pNormal.xz -= dBoulder.xz;
  // pNormal = normalize(pNormal);
  vec3 target = normalize(position + pNormal ) * h;
  vNormal = normalMatrix * normal;
  vec3 p = position;
  p = rotateVectorAxisAngle(p, vec3(0, 0, 1.), PI/2.+ atan(direction.z, direction.x));
  float f = inCubic(position.z);
  p = mix(p, target, f);
  // p = mix(p, p - dBoulder * l, f);
  // p *= length(dBoulder);

  vDry = curlV.a;

  p = (instanceMatrix2 * vec4(p, 1.0)).xyz;

  const float offsetRange = 2.;
  vec3 ct = cameraTarget/scale;
  offset = modXZ(
    vec3(ct.x - offsetRange, 0., ct.z - offsetRange),
    vec3(ct.x + offsetRange, 0., ct.z + offsetRange),
    offset
  );

  /* vec3 minOffset = vec3(-10., 0, 10.) - cameraTarget*scale;
  vec3 maxOffset = vec3(10., 0, 10.) - cameraTarget*scale;
  vec3 offsetSize = maxOffset - minOffset;
  offset = mod((offset - minOffset) / offsetSize, 1.) * offsetSize + minOffset; */
  
  p += offset;
  // p.y *= 2. / length(vec3(position.x, 0., position.z));
  p.y *= 1.5;
  p *= scale;
  
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;;
}`;

const fragmentShader = `precision highp float;

in vec2 vUv;
in float vDry;
in float vLight;

uniform sampler2D blade;

out vec4 fragColor;

void main() {
  vec4 c = texture(blade, vUv);
  if(c.r < .5) {
    discard;
  }
  vec3 color1 = vec3(75., 112., 34.) / 255.;
  vec3 color2 = vec3(93., 128., 47.) / 255.;
  vec3 color3 = vec3(102., 146., 44.)/ 255.;
  vec3 color4 = vec3(216., 255., 147.)/ 255.;

  vec3 color = mix(mix(color1, color2, vUv.y), color3, vDry);
  color = mix(color, color4, 0.3 + vLight*0.7);
  fragColor = vec4(color * vUv.y, 1.);
}`;

class GrassMaterial extends RawShaderMaterial {
  constructor(options) {
    super({
      vertexShader,
      fragmentShader,
      glslVersion: GLSL3,
      ...options,
      uniforms: {
        scale: { value: 1 },
        curlMap: { value: null },
        boulder: { value: new Vector3() },
        time: { value: 0 },
        persistence: { value: 1 },
        blade: { value: blade },
        cameraTarget: { value: new Vector3() },
        direction: { value: new Vector3() },
        offsetTexture: { value: null },
        offsetTexture2: { value: null },
        quaternionTexture: { value: null },
        quaternionTexture2: { value: null },
        scaleTexture: { value: null },
      },
      side: DoubleSide,
      transparent: true,
    });
  }
}

export { GrassMaterial };
