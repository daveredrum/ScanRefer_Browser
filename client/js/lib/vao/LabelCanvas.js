import GLProgram from "../webgl/GLProgram";
import * as Segments2DGLSL from "../shader/Segments2DGLSL";

class LabelCanvas{

    init(gl, left, top, width, height, num_segments, is_interactive) {
        this.gl = gl;
        this.width = width;
        this.height = height;
        this.left = left;
        this.top = top;
        this.vao = new Object();
        this.vao.program = GLProgram.compile_shaders_and_link_with_program(gl, Segments2DGLSL.VS, Segments2DGLSL.FS.format(""+num_segments));
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

        this.texture = gl.createTexture();
        if (is_interactive) {
            this.setup_framebuffer()
        }
        gl.useProgram(null);

    }

    setup_framebuffer(){
        let gl = this.gl;
        this.vao.fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.vao.fbo);

        this.vao.offscreen_texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.vao.offscreen_texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.width, this.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.vao.offscreen_texture, 0);

        this.vao.out_superpixel_indices = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.vao.out_superpixel_indices);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.width, this.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, this.vao.out_superpixel_indices, 0);

        let depth_unreadable = gl.createRenderbuffer();
        gl.bindRenderbuffer(gl.RENDERBUFFER, depth_unreadable);
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, this.width, this.height);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth_unreadable);

        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
            console.log("Error with framebuffers", gl.checkFramebufferStatus(gl.FRAMEBUFFER));
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.bindRenderbuffer(gl.RENDERBUFFER, null);

    }

    load_texture(image) {
        let vao = this.vao;
        let gl = this.gl;  
        gl.useProgram(this.vao.program);
        gl.activeTexture(gl.TEXTURE0);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1); 
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
        gl.useProgram(null);
    } 

    draw(colors, draw_offscreen) {
        let vao = this.vao;
        let gl = this.gl;

        gl.useProgram(vao.program);

        if (draw_offscreen) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, vao.fbo);
            gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
        }

        // positions
        gl.bindBuffer(gl.ARRAY_BUFFER, vao.vbo_vertices);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(0);
        // uvs
        gl.bindBuffer(gl.ARRAY_BUFFER, vao.vbo_uvs);
        gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(1);
        //colors
        gl.uniform4fv(gl.getUniformLocation(vao.program, "colors"), colors);
        // texture
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.uniform1i(gl.getUniformLocation(vao.program, "sampler"), 0);
        
        gl.enable(gl.SCISSOR_TEST);
        gl.viewport(this.left, this.top, this.width, this.height);
        gl.scissor(this.left, this.top, this.width, this.height);
        
        gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
        gl.disable(gl.SCISSOR_TEST);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        gl.useProgram(null);
    }

    get_segment_indices(x, y, area = 0) {
        let vao = this.vao;
        let gl = this.gl;
        gl.useProgram(vao.id_program);
        gl.bindFramebuffer(gl.FRAMEBUFFER, vao.fbo); 
        gl.enable(gl.SCISSOR_TEST);
        gl.viewport(this.left, this.top, this.width, this.height);
        gl.scissor(this.left, this.top, this.width, this.height);
        gl.readBuffer(gl.COLOR_ATTACHMENT1);

        // decide box bounds based on area
        let x_left = (x - area) >= 0 ? (x - area) : 0;
        let x_right = (x + area) <= (this.width - 1) ? (x + area) : (this.width - 1);
        let y_top = (y - area) >= 0 ? (y - area) : 0;
        let y_bottom = (y + area) <= (this.height - 1) ? (y + area) : (this.height - 1);

        let num_pixels = (x_right - x_left + 1) * (y_bottom - y_top + 1);
        let center_pixel = (x_right - x_left + 1) * (y_bottom - y) + (x - x_left);

        let pixels = new Uint8Array(4 * num_pixels);
        gl.readPixels(x_left, this.height - 1 - y_bottom, (x_right - x_left + 1), (y_bottom - y_top + 1), this.gl.RGBA, this.gl.UNSIGNED_BYTE, pixels, 0);        
        let segment_ids = [pixels[4 * center_pixel] + pixels[4 * center_pixel + 1] * 256 + pixels[4 * center_pixel + 2] * 256 * 256];
        for (let i = 0; i < num_pixels; i++) {
            segment_ids.push(pixels[4 * i] + pixels[4 * i + 1] * 256 + pixels[4 * i + 2] * 256 * 256);
        }
        segment_ids = new Set(segment_ids);
        gl.disable(gl.SCISSOR_TEST);
        gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
        gl.useProgram(null);
        return [...segment_ids];
    }
}

export default LabelCanvas;