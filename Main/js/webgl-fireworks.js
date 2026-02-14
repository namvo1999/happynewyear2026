// WebGL 2 Shader-based Fireworks
// Heart-shaped particle effects with trails

class WebGLFireworks {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) {
      console.error('WebGL canvas not found');
      return;
    }
    
    this.gl = this.canvas.getContext('webgl2');
    if (!this.gl) {
      console.warn('WebGL 2 not supported');
      return;
    }
    
    this.enabled = false;
    this.animationId = null;
    this.initShaders();
    this.initBuffers();
    this.initUniforms();
    this.resize();
    
    // Listen for resize events
    window.addEventListener('resize', () => this.resize());
  }
  
  initShaders() {
    const gl = this.gl;
    
    const vs = `#version 300 es
in vec2 a;
void main(){ gl_Position=vec4(a,0,1); }`;

    const fs = `#version 300 es
precision highp float;
uniform vec3  iResolution;
uniform float iTime;
uniform vec4  iMouse;
out vec4 fragColor;

/* -----------  SHADER CODE  ------------ */
#define rad(x) radians(x)
#define np 35.
#define snp 28.
#define spawn 1
#define trail 1

vec2 N22(vec2 p){
    vec3 a = fract(p.xyx*vec3(123.34, 234.34, 345.65));
    a += dot(a, a+34.45);
    return fract(vec2(a.x*a.y, a.y*a.z));
}
float hash(vec2 uv){
    return fract(sin(dot(uv,vec2(154.45,64.548))) * 124.54); 
}

vec3 particle(vec2 st, vec2 p, float r, vec3 col){
    float d = length(st-p);
    d = smoothstep(r, r-2.0/iResolution.y, d);
    return d*col;
}
vec3 burst(vec2 st, vec2 pos, float r, vec3 col, int heart) {
    st -= pos;
    if (heart==1) st.y -= sqrt(abs(st.x))*0.1;
    r *=0.6*r;
    return (r/dot(st, st))*col*0.4; // Reduced from 0.6 to 0.4
}

vec2 get_pos(vec2 u, vec2 a, vec2 p0, float t, float ang){
    ang = rad(ang);
    vec2 d = p0 + vec2(u.x*cos(ang), u.y*sin(ang))*t + 0.5*a*t*t;
    return d;
}
vec2 get_velocity(vec2 u, vec2 a, float t, float ang){
    ang = rad(ang);
    return vec2(u.x*cos(ang), u.y*sin(ang)) + a*t;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord ){
    vec2 uv = (2.*fragCoord-iResolution.xy)/iResolution.y;
    vec3 col = vec3(0.0);
    float t = mod(iTime, 10.);
    
    float r = 0.04;
    vec2 u = vec2(5.);
    vec2 a = vec2(0.0, -9.8);
    float ang = 75.0;

    vec3 p1 = vec3(0.0);
    
    for (float i=0.; i<np; i++){
        vec2 rand = N22(vec2(i));
        vec2 ip = vec2(sin(15.*rand.x), -1.+r);
        u = vec2(sin(5.*rand.x), 5.+sin(4.*rand.y));
        float t1 = t-i/5.;
        vec2 s = get_pos(u, a, ip, t1, ang);
        vec2 v = get_velocity(u, a, t1, ang);
        float Tf = 2.0*u.y*sin(rad(ang))/abs(a.y);
        vec2 H = get_pos(u, a, ip, Tf/2.0, ang);
        vec3 pcol = vec3(0.8, 0.35 + rand.x*0.25, 0.6 + rand.y*0.15); // Reduced brightness

        if (v.y<-0.5){ r=0.0; }
        p1 += burst(uv, s, r, pcol, 0);

        if (trail==1){
            for (float k=4.0; k>0.0; k--){
                vec2 strail = get_pos(u, a, ip, t1-(k*0.02), ang);
                p1 += burst(uv, strail, v.y<-0.5?0.0:r-(k*0.006), pcol, 0);
            }
        }
        
        if (v.y<=0.0 && t1>=Tf/2.0 && spawn==1){
            for (float j=0.0; j<snp; j++){
                vec2 rand2 = N22(vec2(j));
                float ang2 = (j*(360./snp));
                r = 0.035;
                r -= (t1-Tf*0.5)*0.04;
                float x = cos(rad(ang2));
                float y = sin(rad(ang2));
                y = y + abs(x) * sqrt( (8.- abs(x))/50.0 );
                vec2 heart = vec2(x*x + y*y)*(0.4/(t1*sqrt(t1)));
                vec2 S = get_pos(heart, a*0.03, H, t1-(Tf/2.), ang2);
                pcol = vec3(0.8, 0.4 + rand2.x*0.15, 0.65 + rand2.y*0.1); // Reduced brightness
                p1 += burst(uv, S, max(0.0,r), pcol, 0);
            }
        } 
    }
    
    float stars = pow(hash(uv),200.) * 0.5;
    col = p1;
    vec3 night = vec3(0.06, 0.02, 0.18)*vec3(uv.y*0.5+0.5)+vec3(stars)*vec3(uv.y*0.5+0.5);
    col += night*(1.0-p1);
    fragColor = vec4(col,1.0);
}
/* ----------------------------------------------- */

void main(){ mainImage(fragColor, gl_FragCoord.xy); }
`;

    this.program = this.compileProgram(vs, fs);
    this.gl.useProgram(this.program);
  }
  
  compileProgram(vertexSource, fragmentSource) {
    const gl = this.gl;
    
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, vertexSource);
    gl.compileShader(vertexShader);
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
      console.error('Vertex shader error:', gl.getShaderInfoLog(vertexShader));
    }
    
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, fragmentSource);
    gl.compileShader(fragmentShader);
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
      console.error('Fragment shader error:', gl.getShaderInfoLog(fragmentShader));
    }
    
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program));
    }
    
    return program;
  }
  
  initBuffers() {
    const gl = this.gl;
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    
    const loc = gl.getAttribLocation(this.program, 'a');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  }
  
  initUniforms() {
    const gl = this.gl;
    this.uniforms = {
      resolution: gl.getUniformLocation(this.program, 'iResolution'),
      time: gl.getUniformLocation(this.program, 'iTime'),
      mouse: gl.getUniformLocation(this.program, 'iMouse')
    };
    
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseZ = 0;
    
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouseX = e.clientX - rect.left;
      this.mouseY = this.canvas.height - (e.clientY - rect.top);
    });
    
    this.canvas.addEventListener('mousedown', () => this.mouseZ = 1);
    this.canvas.addEventListener('mouseup', () => this.mouseZ = 0);
  }
  
  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    if (this.gl) {
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }
  }
  
  render(time) {
    if (!this.enabled || !this.gl) return;
    
    const gl = this.gl;
    gl.uniform3f(this.uniforms.resolution, this.canvas.width, this.canvas.height, 1.0);
    gl.uniform1f(this.uniforms.time, time * 0.001 * 0.38);
    gl.uniform4f(this.uniforms.mouse, this.mouseX, this.mouseY, this.mouseZ, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    
    this.animationId = requestAnimationFrame((t) => this.render(t));
  }
  
  start() {
    if (!this.gl) return;
    this.enabled = true;
    this.canvas.style.display = 'block';
    if (!this.animationId) {
      this.animationId = requestAnimationFrame((t) => this.render(t));
    }
  }
  
  stop() {
    this.enabled = false;
    this.canvas.style.display = 'none';
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }
  
  toggle() {
    if (this.enabled) {
      this.stop();
    } else {
      this.start();
    }
  }
}

// Global instance
let webglFireworks = null;

// Initialize when DOM is ready
function initWebGLFireworks() {
  if (!webglFireworks) {
    webglFireworks = new WebGLFireworks('webgl-canvas');
  }
  return webglFireworks;
}
