import GLProgram from "../webgl/GLProgram";
import * as OBJMeshUVGLSL from "../shader/OBJMeshUVGLSL";
import * as AttrReaderGLSL from "../../lib/shader/AttrReaderGLSL";
import * as PlanarProjectionFilterGLSL from "../../lib/shader/PlanarProjectionFilterGLSL";
import * as LabeledPlaneScanGLSL from "../../lib/shader/LabeledPlaneScanGLSL";
import * as geometry from "../../lib/geometry/Utils"

//TODO: Be careful using the same name for each model type
class VAOType {
    constructor() {
        this.id_program = null;
        this.id_vbo_normals = null;
        this.id_vbo_vertices = null;
        this.id_vbo_uvs = null;
        this.texture = null;
        this.n_positions = 0;
    }
}

class StructureLabelerScan {
    init(gl, window_width, window_height, depth_mode=1) {
        this.gl = gl;
        this.window_width = window_width;
        this.window_height = window_height;
        this.depth_mode = depth_mode;

        this.vao = new VAOType();
        
        this.init_shaders();
    }

    init_shaders(){
        let gl = this.gl;

        // Shaders for drawing to screen
        this.vao.onscreen_program = GLProgram.compile_shaders_and_link_with_program(gl, OBJMeshUVGLSL.VS, OBJMeshUVGLSL.FS.format(this.depth_mode));
        // Shaders for reading depth and normal
        this.vao.depth_normal_reader_program = GLProgram.compile_shaders_and_link_with_program(gl, AttrReaderGLSL.DepthNormalVS, AttrReaderGLSL.DepthNormalFS);
        
        // Shaders used in draw()
        this.vao.id_program = this.vao.onscreen_program;

        gl.useProgram(this.vao.id_program);

        // positions
        this.vao.id_vbo_vertices = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vao.id_vbo_vertices);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(0);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        // normals
        this.vao.id_vbo_normals = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vao.id_vbo_normals);
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(1);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        // uvs
        this.vao.id_vbo_uvs = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vao.id_vbo_uvs);
        gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(2);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        // texture
        this.vao.texture = gl.createTexture();
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.vao.texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

        this.setup_attr_reader_framebuffer();
    }

    upload_data(positions, normals, uvs, image, n_positions) {
        /*
            Loads data into gpu memory
            TODO: consider using gl.getAttribLocation() instead of hardcoded index for vertexAttribPointer
        */
        let gl = this.gl;
        let vao = this.vao;

        gl.useProgram(vao.id_program);
        
        vao.n_positions = n_positions;

        gl.bindBuffer(gl.ARRAY_BUFFER, vao.id_vbo_vertices);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        gl.bindBuffer(gl.ARRAY_BUFFER, vao.id_vbo_normals);
        gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        gl.bindBuffer(gl.ARRAY_BUFFER, vao.id_vbo_uvs);
        gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, vao.texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
    }

    setup_attr_reader_framebuffer(){
        /*
            Creates an offscreen buffer that allows access to object depth values
        */

        let gl = this.gl;

        this.vao.fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.vao.fbo);

        // Dummy
        this.vao.offscreen_texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.vao.offscreen_texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.window_width, this.window_height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.vao.offscreen_texture, 0);

        // Texture for reading/rendering depth
        this.vao.depth_readable = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.vao.depth_readable);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.window_width, this.window_height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, this.vao.depth_readable, 0);

        // Textures for reading/rendering normal
        // We need three -- one for each component of the normal -- since we are using the first 24 bits of color to
        //  store a floating point
        this.vao.normal_readable_x = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.vao.normal_readable_x);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.window_width, this.window_height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT2, gl.TEXTURE_2D, this.vao.normal_readable_x, 0);

        this.vao.normal_readable_y = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.vao.normal_readable_y);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.window_width, this.window_height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT3, gl.TEXTURE_2D, this.vao.normal_readable_y, 0);

        this.vao.normal_readable_z = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.vao.normal_readable_z);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.window_width, this.window_height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT4, gl.TEXTURE_2D, this.vao.normal_readable_z, 0);

        // Dummy
        this.vao.depth_unreadable = gl.createRenderbuffer();
        gl.bindRenderbuffer(gl.RENDERBUFFER, this.vao.depth_unreadable);
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, this.window_width, this.window_height);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.vao.depth_unreadable);

        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
            console.log("Error with framebuffers");
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.bindRenderbuffer(gl.RENDERBUFFER, null);

    }

    draw(model_matrix, view_matrix, projection_matrix, is_draw_offscreen) {
        let vao = this.vao;
        let gl = this.gl;

        // let before = gl.getParameter(gl.FRAMEBUFFER_BINDING);
        if (is_draw_offscreen){
            gl.bindFramebuffer(gl.FRAMEBUFFER, vao.fbo);
            gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1, gl.COLOR_ATTACHMENT2, gl.COLOR_ATTACHMENT3, gl.COLOR_ATTACHMENT4]);
            gl.clearColor(230/255.0, 240/255.0, 230/255.0, 1.0);  // Clear to black, fully opaque
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            // gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        }
        // console.log("before/after", before, gl.getParameter(gl.FRAMEBUFFER_BINDING));

        gl.useProgram(vao.id_program);
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.CULL_FACE);

        // positions
        gl.bindBuffer(gl.ARRAY_BUFFER, vao.id_vbo_vertices);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(0);

        // normals
        gl.bindBuffer(gl.ARRAY_BUFFER, vao.id_vbo_normals);
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(1);

        // uvs
        gl.bindBuffer(gl.ARRAY_BUFFER, vao.id_vbo_uvs);
        gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(2);

        // texture
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, vao.texture);

        gl.uniform1i(gl.getUniformLocation(vao.id_program, "sampler"), 0);
        gl.uniformMatrix4fv(gl.getUniformLocation(vao.id_program, "model_matrix"), false, new Float32Array(model_matrix.elements));
        gl.uniformMatrix4fv(gl.getUniformLocation(vao.id_program, "view_matrix"), false, new Float32Array(view_matrix.elements));
        gl.uniformMatrix4fv(gl.getUniformLocation(vao.id_program, "projection_matrix"), false, new Float32Array(projection_matrix.elements));

        gl.drawArrays(gl.TRIANGLES, 0, vao.n_positions);

        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.CULL_FACE);

        gl.useProgram(null);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    setup_depth_map() {
        let vao = this.vao;
        let gl = this.gl;

        gl.bindFramebuffer(gl.FRAMEBUFFER, vao.fbo);
        gl.readBuffer(gl.COLOR_ATTACHMENT1);
        let pixels = new Uint8Array(this.window_height * this.window_width * 4);
        gl.readPixels(0, 0, this.window_width, this.window_height, this.gl.RGBA, this.gl.UNSIGNED_BYTE, pixels, 0);
        
        let depth = new Float32Array(this.window_height * this.window_width);
        for (let i = 0; i < this.window_height; i++) {
            for (let j = 0; j < this.window_width; j++) {
                depth[i * this.window_width + j] = 0;
                depth[i * this.window_width + j] |= pixels[((this.window_height - 1 - i) * this.window_width + j) * 4 + 0] << 0;
                depth[i * this.window_width + j] |= pixels[((this.window_height - 1 - i) * this.window_width + j) * 4 + 1] << 8;
                depth[i * this.window_width + j] |= pixels[((this.window_height - 1 - i) * this.window_width + j) * 4 + 2] << 16;
                depth[i * this.window_width + j] /= 16777215.0; 
            }
        }
    
        gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
        this.depth_map = depth;
    }

    world_pos_from_canvas_pos(canvas_pos, window_manager){
        /*
            Calculates world coordinates (as THREE.Vector4) by sampling the depth buffer at canvas_pos
        */
        let gl = this.gl;

        // Set offscreen buffer
        this.vao.id_program = this.vao.depth_normal_reader_program;
        
        // Draw scan to offscreen depth buffer
        this.draw(this.model_matrix, window_manager.camera.matrixWorldInverse, window_manager.projection_matrix, true);

        // Reset scan_vao.id_program
        this.vao.id_program = this.vao.onscreen_program;

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.vao.fbo);
        gl.readBuffer(gl.COLOR_ATTACHMENT1);
        let offscreen_depth = new Uint8Array(4);  // One byte for each RGBA channel

        // We invert y here because canvas coords are from top left, whereas gl texture coords are from bottom left
        gl.readPixels(canvas_pos.x, (window_manager.window_height - canvas_pos.y), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, offscreen_depth, 0);

        let depth = this.rgba_tuple_to_float(offscreen_depth);

        // Transform from NDC to world
        return window_manager.project_ndc_to_world(
                    new THREE.Vector4(
                         (canvas_pos.x / window_manager.window_width) * 2.0 - 1.0,
                        -(canvas_pos.y / window_manager.window_height) * 2.0 + 1.0, // Y is inverted again
                          depth * 2.0 - 1.0, 1));
    }

    normal_from_canvas_pos(canvas_pos, window_manager){
        /*
            Calculates world coordinates (as THREE.Vector4) by sampling the depth buffer at canvas_pos
        */
        let gl = this.gl;

        // Set offscreen buffer
        this.vao.id_program = this.vao.depth_normal_reader_program;
        
        // Draw scan to offscreen depth buffer
        this.draw(this.model_matrix, window_manager.camera.matrixWorldInverse, window_manager.projection_matrix, true);

        // Reset scan_vao.id_program
        this.vao.id_program = this.vao.onscreen_program;

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.vao.fbo);

        // Get normal, one component at a time
        let normal = new THREE.Vector3();
        for (let i=0; i<3; i++){
            let normal_component = new Uint8Array(4);
            gl.readBuffer(gl['COLOR_ATTACHMENT' + (i + 2)]);  // Each component of normal is stored in its own texture (x:2, y:3, z:4)
            
            // We invert y here because canvas coords are from top left, whereas gl texture coords are from bottom left
            gl.readPixels(canvas_pos.x, (window_manager.window_height - canvas_pos.y), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, normal_component, 0);
            
            normal.setComponent(i, this.rgba_tuple_to_float(normal_component) * 2.0 - 1.0);
        }

        return normal;
    }

    world_pos_and_normal_from_canvas_pos(canvas_pos, window_manager){
        /*
            Returns both world position and normal at a givin 2d point. We do both at the same time to reduce overhead.

            input: THREE.Vector2 representing the 2d (canvas) coords at which to sample depth/normal
            output: {
                normal: <THREE.Vector3> normal,
                world_pos: <THREE.Vector3> world_position
            }
        */
        let gl = this.gl;

        // Set offscreen buffer
        this.vao.id_program = this.vao.depth_normal_reader_program;
        
        // Draw scan to offscreen depth buffer
        this.draw(this.model_matrix, window_manager.camera.matrixWorldInverse, window_manager.projection_matrix, true);

        // Reset scan_vao.id_program
        this.vao.id_program = this.vao.onscreen_program;

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.vao.fbo);

        /*********** Get Depth ***********/
        gl.readBuffer(gl.COLOR_ATTACHMENT1);
        let offscreen_value = new Uint8Array(4);  // One byte for each RGBA channel

        // We invert y here because canvas coords are from top left, whereas gl texture coords are from bottom left
        gl.readPixels(canvas_pos.x, (window_manager.window_height - canvas_pos.y), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, offscreen_value, 0);

        let depth = this.rgba_tuple_to_float(offscreen_value);

        // Transform from NDC to world
        let world_pos = window_manager.project_ndc_to_world(
                    new THREE.Vector4(
                         (canvas_pos.x / window_manager.window_width) * 2.0 - 1.0,
                        -(canvas_pos.y / window_manager.window_height) * 2.0 + 1.0, // Y is inverted again
                          depth * 2.0 - 1.0, 1));


        /*********** Get Normal ***********/
        // Get normal, one component at a time
        let normal = new THREE.Vector3();
        for (let i=0; i<3; i++){
            // let offscreen_value = new Uint8Array(4);
            gl.readBuffer(gl['COLOR_ATTACHMENT' + (i + 2)]);  // Each component of normal is stored in its own texture (x:2, y:3, z:4)
            
            // We invert y here because canvas coords are from top left, whereas gl texture coords are from bottom left
            gl.readPixels(canvas_pos.x, (window_manager.window_height - canvas_pos.y), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, offscreen_value, 0);
            
            normal.setComponent(i, this.rgba_tuple_to_float(offscreen_value) * 2.0 - 1.0);
        }

        return {
            normal: normal,
            world_pos: world_pos
        };

    }

    rgba_tuple_to_float(rgba_tuple){
        /* 
            Extracts a 24bit floating point stored in a 4-tuple of unsigned integers (see shader for encoding proceedure)
        */
        let float_out = 0;
        float_out |= rgba_tuple[0] << 0;
        float_out |= rgba_tuple[1] << 8;
        float_out |= rgba_tuple[2] << 16;
        float_out /= 16777215.0;  // Divide by 2^24 - 1 so the float_out is in [0,1), undoing the multiplication in the shader

        return float_out;
    }

}

/* Subclass  */
class PlanarStructureScan extends StructureLabelerScan {
    constructor(){
        super();
    }

    init_shaders(){
        let gl = this.gl;

        // Shaders for drawing to screen
        this.vao.onscreen_program = GLProgram.compile_shaders_and_link_with_program(gl, LabeledPlaneScanGLSL.VS, LabeledPlaneScanGLSL.FS);

        // this.vao.planar_projection_program = GLProgram.compile_shaders_and_link_with_program(gl, PlanarProjectionFilterGLSL.VS, PlanarProjectionFilterGLSL.FS);

        // Shaders for reading depth and normal
        this.vao.depth_normal_reader_program = GLProgram.compile_shaders_and_link_with_program(gl, AttrReaderGLSL.DepthNormalVS, AttrReaderGLSL.DepthNormalFS);
        
        // Shaders used in draw()
        this.vao.id_program = this.vao.onscreen_program;

        gl.useProgram(this.vao.id_program);

        // positions
        this.vao.id_vbo_vertices = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vao.id_vbo_vertices);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(0);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        // normals
        this.vao.id_vbo_normals = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vao.id_vbo_normals);
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(1);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        // uvs
        this.vao.id_vbo_uvs = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vao.id_vbo_uvs);
        gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(2);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        // plane color
        this.vao.id_plane_color_overlay = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vao.id_plane_color_overlay);
        gl.vertexAttribPointer(3, 4, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(3);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        // texture
        this.vao.texture = gl.createTexture();
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.vao.texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

        this.setup_attr_reader_framebuffer();
    }

    upload_data(positions, normals, uvs, image, n_positions){
        super.upload_data(positions, normals, uvs, image, n_positions);

        let gl = this.gl;

        // Init plane color overlay with all zeros, i.e. don't display anything until plane membership is determined
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vao.id_plane_color_overlay);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(n_positions * 4), gl.DYNAMIC_DRAW);
        gl.vertexAttribPointer(3, 4, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        this.positions = positions;
        this.normals = normals;
    }

    setup_planar_projection_framebuffer(){
        /*
            Creates an offscreen buffer that calculates if a point is near a plane
        */

        let gl = this.gl;

        let w = 4096; 
        let h = Math.ceil(this.vao.n_positions / w);

        this.vao.planar_projection_fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.vao.planar_projection_fbo);

        // Dummy
        this.vao.offscreen_texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.vao.offscreen_texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.vao.offscreen_texture, 0);

        // Texture for holding planar membership data
        this.vao.plane_membership_readable = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.vao.plane_membership_readable);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, this.vao.plane_membership_readable, 0);

        // Dummy
        this.vao.plane_membership_unreadable = gl.createRenderbuffer();
        gl.bindRenderbuffer(gl.RENDERBUFFER, this.vao.plane_membership_unreadable);
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.vao.plane_membership_unreadable);

        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
            console.log("Error with framebuffers");
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.bindRenderbuffer(gl.RENDERBUFFER, null);

        this.planar_projection_framebuffer_set = true;
    }

    draw(model_matrix, view_matrix, projection_matrix, is_draw_offscreen) {
        let vao = this.vao;
        let gl = this.gl;

        // let before = gl.getParameter(gl.FRAMEBUFFER_BINDING);
        if (is_draw_offscreen){
            gl.bindFramebuffer(gl.FRAMEBUFFER, vao.fbo);
            gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1, gl.COLOR_ATTACHMENT2, gl.COLOR_ATTACHMENT3, gl.COLOR_ATTACHMENT4]);
            gl.clearColor(230/255.0, 240/255.0, 230/255.0, 1.0);  // Clear to black, fully opaque
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            // gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        }
        // console.log("before/after", before, gl.getParameter(gl.FRAMEBUFFER_BINDING));

        gl.useProgram(vao.id_program);
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.CULL_FACE);

        // positions
        gl.bindBuffer(gl.ARRAY_BUFFER, vao.id_vbo_vertices);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(0);

        // normals
        gl.bindBuffer(gl.ARRAY_BUFFER, vao.id_vbo_normals);
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(1);

        // uvs
        gl.bindBuffer(gl.ARRAY_BUFFER, vao.id_vbo_uvs);
        gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(2);

        // plane color overlay
        gl.bindBuffer(gl.ARRAY_BUFFER, vao.id_plane_color_overlay);
        gl.vertexAttribPointer(3, 4, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(3);

        // texture
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, vao.texture);

        gl.uniform1i(gl.getUniformLocation(vao.id_program, "sampler"), 0);
        gl.uniformMatrix4fv(gl.getUniformLocation(vao.id_program, "model_matrix"), false, new Float32Array(model_matrix.elements));
        gl.uniformMatrix4fv(gl.getUniformLocation(vao.id_program, "view_matrix"), false, new Float32Array(view_matrix.elements));
        gl.uniformMatrix4fv(gl.getUniformLocation(vao.id_program, "projection_matrix"), false, new Float32Array(projection_matrix.elements));

        gl.drawArrays(gl.TRIANGLES, 0, vao.n_positions);

        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.CULL_FACE);

        gl.useProgram(null);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    get_points_belonging_to_plane_gpu(model_matrix, view_matrix, projection_matrix, normal, offset, threshold){
        // Use planar projection shader to fill pseudo-1d mask where mask[vertex_id] == 1 
        // if vertex_id is less than threshold away from the plane defined by normal and offset
        // make sure gl.DEPTH_TEST and gl.CULL_FACE are turned off

        if (!this.planar_projection_framebuffer_set){
            this.setup_planar_projection_framebuffer();
        }

        let vao = this.vao;
        let gl = this.gl;

            let w = 4096;          
        let h = Math.ceil(this.vao.n_positions / w);
        gl.viewport(0, 0, w, h);

        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.CULL_FACE);


        gl.bindFramebuffer(gl.FRAMEBUFFER, vao.planar_projection_fbo);
        gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
        gl.clearColor(0.0, 0.0, 0.0, 1.0);  // Clear to black, fully opaque
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        gl.useProgram(vao.planar_projection_program);

        // positions
        gl.bindBuffer(gl.ARRAY_BUFFER, vao.id_vbo_vertices);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(0);

        // normals
        // gl.bindBuffer(gl.ARRAY_BUFFER, vao.id_vbo_normals);
        // gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
        // gl.enableVertexAttribArray(1);

        gl.uniform3f(gl.getUniformLocation(vao.planar_projection_program, "plane_normal"), normal[0], normal[1], normal[2]);
        gl.uniform3f(gl.getUniformLocation(vao.planar_projection_program, "plane_point"), offset[0], offset[1], offset[2]);
        gl.uniform1f(gl.getUniformLocation(vao.planar_projection_program, "threshold"), threshold);
        gl.uniform1i(gl.getUniformLocation(vao.planar_projection_program, "n_vertices"), this.vao.n_positions);

        gl.uniformMatrix4fv(gl.getUniformLocation(vao.planar_projection_program, "model_matrix"), false, new Float32Array(model_matrix.elements));
        gl.uniformMatrix4fv(gl.getUniformLocation(vao.planar_projection_program, "view_matrix"), false, new Float32Array(view_matrix.elements));
        gl.uniformMatrix4fv(gl.getUniformLocation(vao.planar_projection_program, "projection_matrix"), false, new Float32Array(projection_matrix.elements));

        gl.drawArrays(gl.TRIANGLES, 0, vao.n_positions);
        // gl.drawArrays(gl.POINTS, 0, vao.n_positions);

        // Retrieve data  CONTINUE FROM HERE (is indices the right shape?)

        let indices = new Uint8Array(w * h * 4);
        gl.readBuffer(gl['COLOR_ATTACHMENT1']);
            
        // Read entire array
        gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, indices);
            
        window.indices = indices;

        gl.useProgram(null);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, this.window_width, this.window_height);
        
        // TODO: convert [0, 1, 0, 1] -> [1,3]

        return indices;
    }

    get_points_belonging_to_plane_cpu(model_matrix, view_matrix, projection_matrix, normal, offset, threshold){
        // TODO: Time this, try rewriting p2p distance to avoid creating a new Vector object
        var indices = [];
        let min = Infinity;
        for (let i=0; i < this.positions.length; i += 3){
            let d = geometry.point_to_plane_distance((new THREE.Vector3()).fromArray(this.positions.slice(i, i + 3)), normal, offset);
            if (d < threshold){
                indices.push(i);
            }
        }
        return indices;
    }


    get_planar_membership_cpu(planes, point_to_plane_threshold, normal_similarity_threshold){
        /*
            Inputs:
                planes: dictionary of objects, which should look like:
                    {
                        p_id: {
                            normal: THREE.Vector3,
                            offset: THREE.Vector3
                        }
                    }
                point_to_plane_threshold: float indicating the maximum distance from a plane for which
                                          a point will be considered to belong to that plane.
                normal_similarity_threshold: float indicating the minimum inner product between the plane normal
                                             and mesh normal at a given point, with both being normalized

            Output:
                list of plane memberships for each point in the mesh,
                where x_i is in {-1, p_id1, p_id2, ..., p_idn}
        */

        let planar_membership = Array(this.vao.n_positions).fill(-1);
        let point, normal;
        let p_id;

        for (let i = 0; i < this.vao.n_positions; i++){
            point = (new THREE.Vector3()).fromArray(this.positions.slice(i * 3, i * 3 + 3));
            normal =  (new THREE.Vector3()).fromArray(this.normals.slice(i * 3, i * 3 + 3));
            
            // If point is close enough (point_to_plane_threshold) to plane, it has membership in that plane
            // In order to ensure that each point only belongs to one plane, we take the one with
            //  the most similar normal

            let n_similarity = {};
            let dj, nsj;
            for (let p_id of Object.keys(planes)){
                dj = geometry.point_to_plane_distance(point, planes[p_id].normal, planes[p_id].offset);
                
                if (dj < point_to_plane_threshold){
                    nsj = normal.dot(planes[p_id].normal);

                    if (nsj > normal_similarity_threshold){
                        n_similarity[p_id] = nsj;
                    }
                }
            }

            // p_id is the id of the plane whose normal is most simliar to the mesh normal
            //     at the point (largest inner product), while still being within point_to_plane_threshold away
            let candidate_pids = Object.keys(n_similarity);
            if (candidate_pids.length > 0){
                // Calculate id of max value in n_similarity
                planar_membership[i] = candidate_pids.reduce((acc, k) => 
                            {if (n_similarity[k] > n_similarity[acc]){return k} else {return acc}})
            }
        }
        return planar_membership;
    }

    update_planar_point_color_overlay(planes, point_to_plane_threshold=0.07, normal_similarity_threshold=0.707){
        /*
            Inputs:
                planes: dictionary of objects, which should look like:
                    {
                        p_id: {
                            normal: THREE.Vector3,
                            offset: THREE.Vector3,
                            color: [r, g, b]
                        }
                    }
                point_to_plane_threshold: float indicating the maximum distance from a plane for which
                                          a point will be considered to belong to that plane.
                normal_similarity_threshold: float indicating the minimum inner product between the plane normal
                                             and mesh normal at a given point, with both being normalized

        */
        let gl = this.gl;
        let alpha = 0.5;
        let planar_membership = this.get_planar_membership_cpu(planes, point_to_plane_threshold, normal_similarity_threshold);
        let color_overlay = [];
        let inv255 = 1 / 255;

        for (let i=0; i < planar_membership.length; i++){
            // Add overlay color at the same position as the vertex
            if (planar_membership[i] in planes){
                // WebGL requires colors be in [0.0 .. 1.0]^4
                color_overlay.push(...planes[planar_membership[i]].color.slice(0, 3).map(x => inv255 * x), alpha);
            } else {
                color_overlay.push(0.0, 0.0, 0.0, 0.0);
            }
        }
        // console.log("color_overlay", color_overlay);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vao.id_plane_color_overlay);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(color_overlay), gl.DYNAMIC_DRAW);
        gl.vertexAttribPointer(3, 4, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }
}

export default StructureLabelerScan;
export { PlanarStructureScan };