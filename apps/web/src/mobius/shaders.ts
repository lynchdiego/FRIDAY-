// Shaders de la Möbius. Base: referencia/mobius-shader.html (geometría paramétrica,
// luz de borde, especular fino y flujo). Cambios: la fase T llega acumulada desde JS
// (así cambiar la velocidad nunca produce saltos) y se agregó el destello de "piensa".

const common = /* glsl */ `
uniform float T, LT, amp, speak, think, head;
vec3 P(float U, float v){
  float R = 1.0 + 0.05*sin(2.0*U - T) + amp*(0.07*sin(3.0*U + 2.0*T) + 0.045*sin(5.0*U - 3.0*T));
  float W = 0.34*(1.0 + 0.10*sin(2.0*U + T) + amp*0.28*sin(4.0*U - 2.0*T));
  float vv = v*W;
  float ph = U*0.5 + amp*0.18*sin(2.0*U + T);
  return vec3((R + vv*cos(ph))*cos(U)*1.08, (R + vv*cos(ph))*sin(U)*0.92,
              vv*sin(ph)*1.15 + amp*0.09*sin(3.0*U - 2.0*T));
}
`;

export const vertexShader = common + /* glsl */ `
attribute vec2 suv;
varying vec3 vN; varying vec3 vW; varying vec2 vUV;
void main(){
  float Uu = suv.x*6.2831853; float v = suv.y;
  vec3 p = P(Uu, v);
  vec3 du = P(Uu + 0.002, v) - p; vec3 dv = P(Uu, v + 0.01) - p;
  vec3 n = normalize(cross(du, dv));
  vec4 w = modelMatrix*vec4(p, 1.0);
  vW = w.xyz; vN = normalize(mat3(modelMatrix)*n); vUV = vec2(Uu, v);
  gl_Position = projectionMatrix*viewMatrix*w;
}
`;

export const fragmentShader = /* glsl */ `
uniform float T, LT, amp, speak, think, head, gain;
varying vec3 vN; varying vec3 vW; varying vec2 vUV;
void main(){
  vec3 N = normalize(vN); vec3 V = normalize(cameraPosition - vW);
  if (dot(N, V) < 0.0) N = -N;
  float Uu = vUV.x; float v = vUV.y;
  float rim = pow(1.0 - abs(dot(N, V)), 7.0);
  vec3 L1 = normalize(vec3(cos(LT)*0.9, 0.8, 0.7 + 0.3*sin(LT)));
  float spec = pow(max(dot(N, normalize(L1 + V)), 0.0), 220.0);
  vec3 L2 = normalize(vec3(-0.6, -0.5, 0.4));
  float spec2 = pow(max(dot(N, normalize(L2 + V)), 0.0), 60.0)*0.25;
  float flow = pow(0.5 + 0.5*sin(Uu*2.0 - T*2.0 + v*1.4), 40.0)*(0.3 + speak*1.1);
  float edge = smoothstep(0.92, 1.0, abs(v));
  // Piensa: un destello recorre la cinta de forma continua.
  float d = abs(mod(Uu - head + 3.14159265, 6.2831853) - 3.14159265);
  float flash = exp(-d*d*14.0)*think;
  float I = 0.006 + rim*0.9 + spec*2.6 + spec2 + flow*(0.25 + rim*2.0)
          + edge*(0.10 + spec*2.0 + flow*1.6 + rim*0.8)
          + flash*(0.18 + rim*2.2 + edge*1.8);
  // Hombro suave: los brillos fuertes se comprimen en vez de quemarse.
  I = 1.25*(1.0 - exp(-I*gain*0.95));
  gl_FragColor = vec4(vec3(I)*vec3(1.0, 0.975, 0.96), 1.0);
}
`;

// Postproceso final: aberración cromática sutil, viñeta, grano de cine
// y fusión con el fondo #0A0A0A para que la cinta no tenga marco.
export const finishShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    aberration: { value: 0.0022 },
    grain: { value: 0.035 },
    aspect: { value: 1 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float time, aberration, grain, aspect;
    varying vec2 vUv;
    float hash(vec2 p){ p = fract(p*vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y)*p.x); }
    void main(){
      vec2 c = vUv - 0.5;
      vec2 off = c*aberration*(1.0 + 2.0*dot(c, c));
      vec3 col;
      col.r = texture2D(tDiffuse, vUv + off).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv - off).b;
      vec2 cv = c*vec2(max(aspect, 1.0), max(1.0/aspect, 1.0));
      float vig = smoothstep(0.85, 0.2, length(cv));
      col *= vig;
      // El grano se desvanece con la viñeta para que no se note el borde del lienzo.
      col += (hash(vUv*1000.0 + fract(time)*137.0) - 0.5)*grain*vig;
      vec3 bg = vec3(10.0/255.0);
      col = bg + max(col, 0.0)*(1.0 - bg);
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};
