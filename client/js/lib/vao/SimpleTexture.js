import GLProgram from "../webgl/GLProgram";
import * as SimpleTextureGLSL from "../shader/SimpleTextureGLSL";

class SimpleTexture{

    init(gl) {
        this.gl = gl;
        this.vao = new Object();
        this.vao.program = GLProgram.compile_shaders_and_link_with_program(gl, SimpleTextureGLSL.VS, SimpleTextureGLSL.FS);
  
        gl.useProgram(this.vao.program);
      
        // 2x2 square to draw texture on
        this.vao.vbo_vertices = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vao.vbo_vertices);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, 1, -1, -1, 1, -1, 1, 1]), gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        // Texture map
        this.vao.vbo_uvs = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vao.vbo_uvs);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 1, 0, 0, 1, 0, 1, 1]), gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        this.spare_texture = gl.createTexture();
        gl.useProgram(null);
    }

    draw(texture) {
        let vao = this.vao;
        let gl = this.gl;

        gl.useProgram(vao.program);
        // positions
        gl.bindBuffer(gl.ARRAY_BUFFER, vao.vbo_vertices);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(0);
        // uvs
        gl.bindBuffer(gl.ARRAY_BUFFER, vao.vbo_uvs);
        gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(1);
        // texture
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.uniform1i(gl.getUniformLocation(vao.program, "sampler"), 0);
        // draw
        gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
        // reset

        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.useProgram(null);
    }
}

export default SimpleTexture;