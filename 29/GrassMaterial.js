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
// uniform sampler2D offsetTexture;
uniform sampler2D offsetTexture2;
uniform sampler2D quaternionTexture;
uniform sampler2D quaternionTexture2;
// uniform sampler2D scaleTexture;

uniform mat4 modelMatrix;

uniform float time;
uniform sampler2D curlMap;
uniform vec3 boulder;
uniform float size;

// out vec3 vNormal;
out vec2 vUv;
out float vDry;
out float vLight;

#define PI 3.1415926535897932384626433832795
// const float pos_infinity = uintBitsToFloat(0x7F800000);
// const float neg_infinity = uintBitsToFloat(0xFF800000);









// Simplex 2D noise
//
vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }

float snoise(vec2 v){
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
           -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy) );
  vec2 x0 = v -   i + dot(i, C.xx);
  vec2 i1;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
  + i.x + vec3(0.0, i1.x, 1.0 ));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
    dot(x12.zw,x12.zw)), 0.0);
  m = m*m ;
  m = m*m ;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}
//	Simplex 3D Noise 
//	by Ian McEwan, Ashima Arts
//
vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}

float snoise(vec3 v){ 
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

// First corner
  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 =   v - i + dot(i, C.xxx) ;

// Other corners
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );

  //  x0 = x0 - 0. + 0.0 * C 
  vec3 x1 = x0 - i1 + 1.0 * C.xxx;
  vec3 x2 = x0 - i2 + 2.0 * C.xxx;
  vec3 x3 = x0 - 1. + 3.0 * C.xxx;

// Permutations
  i = mod(i, 289.0 ); 
  vec4 p = permute( permute( permute( 
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

// Gradients
// ( N*N points uniformly over a square, mapped onto an octahedron.)
  float n_ = 1.0/7.0; // N=7
  vec3  ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z *ns.z);  //  mod(p,N*N)

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)

  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );

  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);

//Normalise gradients
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

// Mix final noise value
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), 
                                dot(p2,x2), dot(p3,x3) ) );
}












vec4 colorNoise(vec2 _st, float _zoom, float _speed, float _alphaSpeed){
	vec2 v1 = _st;
	vec2 v2 = _st;
	vec2 v3 = _st;
	float expon = pow(10.0, _zoom*2.0);
	v1 /= 1.0*expon;
	v2 /= 0.62*expon;
	v3 /= 0.83*expon;
	float n = time*_speed;
	float nr = (snoise(vec3(v1, n)) + snoise(vec3(v2, n)) + snoise(vec3(v3, n))) / 6.0;
	n = time * _speed + 1000.0;
	float ng = (snoise(vec3(v1, n)) + snoise(vec3(v2, n)) + snoise(vec3(v3, n))) / 6.0;
	n = time * _speed + 2000.0;
  float nb = (snoise(vec3(v1, n)) + snoise(vec3(v2, n)) + snoise(vec3(v3, n))) / 6.0;
  n = time * _speed * _alphaSpeed + 3000.0;
  float na = (snoise(vec3(v1, n)) + snoise(vec3(v2, n)) + snoise(vec3(v3, n))) / 6.0;
  return vec4(nr,ng,nb,na);
}











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
vec2 uvWarp(vec2 uv, int dx, int dy) {
  return mod(uv - 0.25 + vec2(dx, dy) * 0.5, 1.);
}
// this function takes a uv coordinate in [0, 1] and returns the distance to the closest side of the square
float distanceToSide(vec2 uv) {
  /* float d = length(uv - 0.5);
  return 1. - d/sqrt(0.5*0.5 + 0.5*0.5); */

  float d = max(abs(uv.x - 0.5), abs(uv.y - 0.5));
  return 1. - d*2.;
}
vec4 fourTap4(sampler2D tex, vec2 uv) {
  vec4 sum = vec4(0.);
  float totalWeight = 0.;
  for (int dx=0; dx<2; ++dx) {
    for (int dy=0; dy<2; ++dy) {
      vec2 uv2 = uvWarp(uv, dx, dy);
      float w = distanceToSide(uv2);
      // w = pow(w, 2.);
      sum += texture(tex, uv2).rgba * w;
      totalWeight += w;
    }
  }
  return sum / totalWeight;
}
vec4 maxTap4(sampler2D tex, vec2 uv) {
  vec4 sum = vec4(0.);
  float totalWeight = 0.;
  for (int dx=0; dx<2; ++dx) {
    for (int dy=0; dy<2; ++dy) {
      vec2 uv2 = uvWarp(uv, dx, dy);
      float w = distanceToSide(uv2);
      // w = pow(w, 2.);
      sum += texture(tex, uv2).rgba * w;
      totalWeight += w;
    }
  }
  // return vec4(normalize(sum.rgb), sum.a);
  // sum.a /= totalWeight;
  // sum.a = pow(sum.a, 0.5);
  // sum.a *= 0.7;
  // sum.a *= 1.5;
  // sum.a = min(sum.a, 1.);
  // sum.rgb *= 0.7;
  return sum;
}
vec3 fourTap3(sampler2D tex, vec2 uv) {
  vec3 sum = vec3(0.);
  float totalWeight = 0.;
  for (int dx=0; dx<2; ++dx) {
    for (int dy=0; dy<2; ++dy) {
      vec2 uv2 = uvWarp(uv, dx, dy);
      float w = distanceToSide(uv2);
      // w = pow(w, 2.);
      sum += texture(tex, uv2).rgb * w;
      totalWeight += w;
    }
  }
  return sum / totalWeight;
}

void main() {
  vec3 offset = vec3(instanceColor.y, 0., instanceColor.z);
  vec2 curlUv = instanceColor.yz / size + 0.5;
  
  const float offsetRange = 2.;
  const float rangeWidth = offsetRange * 2.;
  vec3 ct = cameraTarget/scale;
  vec3 minRange = vec3(ct.x - offsetRange, 0., ct.z - offsetRange);
  vec3 maxRange = vec3(ct.x + offsetRange, 0., ct.z + offsetRange);
  offset = modXZ(
    minRange,
    maxRange,
    offset
  );

  vec3 positionV = texture(offsetTexture2, curlUv).rgb;
  vec4 quaternionV1 = texture(quaternionTexture, curlUv);
  vec4 axisAngleV = texture(quaternionTexture2, curlUv);
  vec4 quaternionV2 = getQuaternionFromAxisAngle(axisAngleV.rgb, axisAngleV.a);
  vec4 quaternionV = multiplyQuaternions(quaternionV1, quaternionV2);
  vec3 scaleV = vec3(1., 1., bladeLength);
  mat4 instanceMatrix2 = compose(positionV, quaternionV, scaleV);

  float id = instanceColor.x;
  vec2 curlTSize = vec2(textureSize(curlMap, 0));
  vec2 curlUv2 = vec2(offset.x, offset.z);
  vec4 curlV = colorNoise(curlUv2 * 400. + id * 0.0002, 1., 4., 0.5);
  curlV.rgb *= 30.;
  // curlV.rb *= 0.2;
  // curlV.g -= 10.;
  curlV.a += 0.5;
  // curlV.a *= 1.25;

  // base position
  vUv = vec2(uv.x, 1.-uv.y);
  vec3 base = (instanceMatrix2 * vec4(position.xy, 0., 1.)).xyz + offset;
  vec3 dBoulder = mod(boulder-base + rangeWidth / 2., rangeWidth) - rangeWidth / 2.;
  vLight = (1./length(dBoulder))/5.;
  vLight = pow(vLight, 2.);
  /* if(length(dBoulder)>cover) {
    dBoulder = vec3(0.);
  } */

  // curl
  vec3 n = curlV.xyz;
  float h = (1.+ curlV.a);
  float l = length(dBoulder) > 0. ? (length(dBoulder)/cover) : 0.;
  vec3 pNormal = (transpose(inverse(modelMatrix)) * vec4(normalize(vec3(.01 * n.xy, 1.)), 1.)).xyz;
  vec3 target = normalize(position + pNormal) * h;
  // vNormal = normalMatrix * normal;
  vec3 p = position;
  float f = inCubic(position.z);
  p = mix(p, target, f);
  // p = mix(p, p - dBoulder * l, f);
  // p *= length(dBoulder);

  vDry = curlV.a;

  p = rotateVectorAxisAngle(p, vec3(0, 0., 1.), PI/2. + atan(direction.z, direction.x));

  p = (instanceMatrix2 * vec4(p, 1.0)).xyz;

  // vec3 instanceDirection = direction; // applyVectorQuaternion(direction, quaternionV);
  
  p += offset;
  // p.y *= 2. / length(vec3(position.x, 0., position.z));
  // p.y *= 1.2;
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
  color = mix(color, color4, 0.5 + vLight * 0.5);
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
        size: { value: 0 },
        time: { value: 0 },
        persistence: { value: 1 },
        blade: { value: blade },
        cameraTarget: { value: new Vector3() },
        direction: { value: new Vector3() },
        // offsetTexture: { value: null },
        offsetTexture2: { value: null },
        quaternionTexture: { value: null },
        quaternionTexture2: { value: null },
        // scaleTexture: { value: null },
      },
      side: DoubleSide,
      transparent: true,
    });
  }
}

export { GrassMaterial };
