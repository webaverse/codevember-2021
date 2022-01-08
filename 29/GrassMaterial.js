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
in mat4 instanceMatrix;
in vec3 instanceColor;
// in vec3 offset;

uniform float scale;
uniform vec3 cameraTarget;
uniform vec3 direction;
uniform mat3 normalMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;

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

void main() {
  const float cover = .25;
  vec3 offset = vec3(instanceMatrix[0][3], instanceMatrix[1][3], instanceMatrix[2][3]);

  vUv = vec2(uv.x, 1.-uv.y);
  vec3 base = (instanceMatrix * vec4(position.xy, 0., 1.)).xyz + offset;
  vec3 dBoulder = (boulder-base);
  vLight = (1./length(dBoulder))/5.;
  vLight = pow(vLight, 2.);
  if(length(dBoulder)>cover) {
    dBoulder = vec3(0.);
  }

  vec2 tSize = vec2(textureSize(curlMap, 0));
  float id = float(int(instanceColor.x));
  vec2 curlUv = instanceColor.yz;
  curlUv = vec2(mod(id, tSize.x)/(tSize.x), (id/tSize.x)/(tSize.y));
  vec4 c = texture(curlMap, curlUv);
  vec3 n = c.xyz;
  float h = (1.+ c.a);
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

  vDry = c.a;

  p = (instanceMatrix * vec4(p, 1.0)).xyz;

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
      },
      side: DoubleSide,
      transparent: true,
    });
  }
}

export { GrassMaterial };
