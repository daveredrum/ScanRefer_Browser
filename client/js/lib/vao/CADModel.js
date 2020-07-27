import GLProgram from "../webgl/GLProgram";
import * as THREE from 'three/build/three';
import * as SimpleCADGLSL from "../shader/SimpleCADGLSL";
import * as OBJMeshUVGLSL from "../shader/OBJMeshUVGLSL";
import * as geometry from "../../lib/geometry/Utils"

window.earcut = require('earcut');
window.mathjs = require('mathjs');
window.THREE = THREE;

//TODO: Be careful using the same name for each model type
class SimpleCADVAO {

    constructor() {
        this.id_program = null;
        this.id_vbo_colors = null;
        this.id_vbo_normals = null;
        this.id_vbo_vertices = null;
        this.id_vbo_indices = null;
        this.n_positions = 0;
        this.model_matrix = new THREE.Matrix4();
    }
}

class CADModel {

    // All CADModels have model_matrices
    constructor(gl, model_matrix) {
        this.model_matrix = model_matrix;
        this.gl = gl;
        this.vao = new SimpleCADVAO();
    }

    init() {

        this.init_shaders();
        this.init_model();  // subclass should define an init_model function that sets positions and normals
        this.upload_data();
    }


    init_shaders(){
        let gl = this.gl;
        
        this.vao.id_program = GLProgram.compile_shaders_and_link_with_program(gl, SimpleCADGLSL.VS, SimpleCADGLSL.FS);
        gl.useProgram(this.vao.id_program);

        // Vertex Positions
        this.vao.id_vbo_vertices = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vao.id_vbo_vertices);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(0);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        // Normals
        // this.vao.id_vbo_normals = gl.createBuffer();
        // gl.bindBuffer(gl.ARRAY_BUFFER, this.vao.id_vbo_normals);
        // gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
        // gl.enableVertexAttribArray(1);
        // gl.bindBuffer(gl.ARRAY_BUFFER, null);

        // Indices
        this.vao.id_vbo_indices = gl.createBuffer();
    }

    upload_data() {
        /*
            Loads data into gpu memory
            TODO: consider using gl.getAttribLocation() instead of hardcoded index for vertexAttribPointer
        */
        let gl = this.gl;
        let vao = this.vao;

        gl.useProgram(vao.id_program);
        

        // Vertex Positions
        gl.bindBuffer(gl.ARRAY_BUFFER, vao.id_vbo_vertices);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.positions), gl.STATIC_DRAW);

        // Normals
        // gl.bindBuffer(gl.ARRAY_BUFFER, vao.id_vbo_normals);
        // gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.normals), gl.STATIC_DRAW);

        // Indices
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.vao.id_vbo_indices);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(this.indices), gl.STATIC_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    }

    draw(view_matrix, projection_matrix) {
        let vao = this.vao;
        let gl = this.gl;

        if (vao.n_positions < 3){
            return;
        }

        gl.enable(gl.DEPTH_TEST);
        gl.disable(gl.CULL_FACE);

        gl.useProgram(vao.id_program);

        // Vertex positions
        gl.bindBuffer(gl.ARRAY_BUFFER, vao.id_vbo_vertices);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(0);

        // Normals
        // gl.bindBuffer(gl.ARRAY_BUFFER, vao.id_vbo_normals);
        // gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
        // gl.enableVertexAttribArray(1);

        // Color
        // console.log(this.color);
        let color = this.color !== undefined ? this.color : [255, 0, 0, 255];
        gl.uniform4f(gl.getUniformLocation(vao.id_program, "colorRGBA"), 1.0 * color[0] / 255, 1.0 * color[1] / 255, 1.0 * color[2] / 255, 1.0 * color[3] / 255);

        // Update MVP matrices
        gl.uniformMatrix4fv(gl.getUniformLocation(vao.id_program, "model_matrix"), false, new Float32Array(this.model_matrix.elements));
        gl.uniformMatrix4fv(gl.getUniformLocation(vao.id_program, "view_matrix"), false, new Float32Array(view_matrix.elements));
        gl.uniformMatrix4fv(gl.getUniformLocation(vao.id_program, "projection_matrix"), false, new Float32Array(projection_matrix.elements));

        // gl.drawArrays(gl.TRIANGLES, 0, vao.n_positions);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, vao.id_vbo_indices);
        gl.drawElements(gl.TRIANGLES, vao.n_positions, gl.UNSIGNED_SHORT, 0);

        gl.disable(gl.DEPTH_TEST);

        gl.useProgram(null);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    }

    position(){
        return (new THREE.Vector3()).fromArray(this.model_matrix.elements.slice(-4, -1));
    }

    vector_to(cad_model){
        // Returns a new vector that points from this to cad_model
        return (new THREE.Vector3()).subVectors(cad_model.position(), this.position());
    }

    generate_unique_id(){
        return CADModel.generate_unique_id();
    }

    static generate_unique_id(){
      /* 
        RFC4122v4 compliant UUID generator
        code is taken from https://stackoverflow.com/a/2117523
       */
      return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
      );
    }
}


class Cube extends CADModel {

    constructor(gl, model_matrix, side_length){
        super(gl, model_matrix);

        this.side_length = side_length;
        this.init(gl);
    }
    

    init_model(){
        let s = this.side_length;
        this.positions = [
             // Front face
            -0.5 * s, -0.5 * s,  0.5 * s,
             0.5 * s, -0.5 * s,  0.5 * s,
             0.5 * s,  0.5 * s,  0.5 * s,
             // 0.5 * s,  0.5 * s,  0.5 * s,
            -0.5 * s,  0.5 * s,  0.5 * s,
            // -0.5 * s, -0.5 * s,  0.5 * s,

            // Back face
            -0.5 * s, -0.5 * s, -0.5 * s,
            -0.5 * s,  0.5 * s, -0.5 * s,
             0.5 * s,  0.5 * s, -0.5 * s,
             // 0.5 * s,  0.5 * s, -0.5 * s,
             0.5 * s, -0.5 * s, -0.5 * s,
            // -0.5 * s, -0.5 * s, -0.5 * s,

            // Top face
            -0.5 * s,  0.5 * s, -0.5 * s,
            -0.5 * s,  0.5 * s,  0.5 * s,
             0.5 * s,  0.5 * s,  0.5 * s,
             // 0.5 * s,  0.5 * s,  0.5 * s,
             0.5 * s,  0.5 * s, -0.5 * s,
            // -0.5 * s,  0.5 * s, -0.5 * s,

            // Bottom face
            -0.5 * s, -0.5 * s, -0.5 * s,
             0.5 * s, -0.5 * s, -0.5 * s,
             0.5 * s, -0.5 * s,  0.5 * s,
             // 0.5 * s, -0.5 * s,  0.5 * s,
            -0.5 * s, -0.5 * s,  0.5 * s,
            // -0.5 * s, -0.5 * s, -0.5 * s,

            // Right face
             0.5 * s, -0.5 * s, -0.5 * s,
             0.5 * s,  0.5 * s, -0.5 * s,
             0.5 * s,  0.5 * s,  0.5 * s,
             // 0.5 * s,  0.5 * s,  0.5 * s,
             0.5 * s, -0.5 * s,  0.5 * s,
             // 0.5 * s, -0.5 * s, -0.5 * s,

            // Left face
            -0.5 * s, -0.5 * s, -0.5 * s,
            -0.5 * s, -0.5 * s,  0.5 * s,
            -0.5 * s,  0.5 * s,  0.5 * s,
            // -0.5 * s,  0.5 * s,  0.5 * s,
            -0.5 * s,  0.5 * s, -0.5 * s,
            // -0.5 * s, -0.5 * s, -0.5 * s
        ];

        this.indices = [
            0, 1, 2,      0, 2, 3,    // Front face
            4, 5, 6,      4, 6, 7,    // Back face
            8, 9, 10,     8, 10, 11,  // Top face
            12, 13, 14,   12, 14, 15, // Bottom face
            16, 17, 18,   16, 18, 19, // Right face
            20, 21, 22,   20, 22, 23  // Left face
        ];



        // this.normals = [
        //      // 0.0,  0.0,  1.0,
        //      // 0.0,  0.0,  1.0,
        //      0.0,  0.0,  1.0,
        //      0.0,  0.0,  1.0,
        //      0.0,  0.0,  1.0,
        //      0.0,  0.0,  1.0,

        //      // 0.0,  0.0, -1.0,
        //      // 0.0,  0.0, -1.0,
        //      0.0,  0.0, -1.0,
        //      0.0,  0.0, -1.0,
        //      0.0,  0.0, -1.0,
        //      0.0,  0.0, -1.0,

        //      // 0.0,  1.0,  0.0,
        //      // 0.0,  1.0,  0.0,
        //      0.0,  1.0,  0.0,
        //      0.0,  1.0,  0.0,
        //      0.0,  1.0,  0.0,
        //      0.0,  1.0,  0.0,

        //      // 0.0, -1.0,  0.0,
        //      // 0.0, -1.0,  0.0,
        //      0.0, -1.0,  0.0,
        //      0.0, -1.0,  0.0,
        //      0.0, -1.0,  0.0,
        //      0.0, -1.0,  0.0,

        //      // 1.0,  0.0,  0.0,
        //      // 1.0,  0.0,  0.0,
        //      1.0,  0.0,  0.0,
        //      1.0,  0.0,  0.0,
        //      1.0,  0.0,  0.0,
        //      1.0,  0.0,  0.0,

        //     // -1.0,  0.0,  0.0,
        //     // -1.0,  0.0,  0.0,
        //     -1.0,  0.0,  0.0,
        //     -1.0,  0.0,  0.0,
        //     -1.0,  0.0,  0.0,
        //     -1.0,  0.0,  0.0,
        // ]; // WebGL requires per-vertex normals that are concatenated and flattened
        
        this.vao.n_positions = this.indices.length;
    }
}

Cube.center = new THREE.Vector3(0, 0, 0);


class Rect extends CADModel {

    constructor(gl, model_matrix, width, height){
        super(gl, model_matrix);

        this.width = width;  // Rect extends 0.5 * width in neg/pos directions of first basis vector
        this.height = height; // Rect extends 0.5 * width in neg/pos directions of second basis vector
        
        this.init();
    }

    init_model(){
        let w = this.width, h = this.height;
        this.positions = [
                -0.5 * w, -0.5 * h, 0.0,
                 0.5 * w, -0.5 * h, 0.0,
                 0.5 * w,  0.5 * h, 0.0,
                -0.5 * w,  0.5 * h, 0.0];

        this.indices = [2, 3, 0, 0, 1, 2];

        this.normals = Array.prototype.concat.apply([], Array(4).fill(Rect.normal.toArray())); // WebGL requires per-vertex normals that are concatenated and flattened

        this.vao.n_positions = 6;
    }
}

Rect.normal = new THREE.Vector3(0, 0, 1);
Rect.center = new THREE.Vector3(0, 0, 0);


class PlanarPolygon extends CADModel {
    constructor(gl, data){
        /* 
            data is a dictionary-like object containing (all optional):
                - <Vector3> normal, 
                - <Vector3> offset, 
                - <[Vector3]> vertices, 
                - <[uint]^4> color, 
                - <String> name, 
                - <String> id
        */
        super(gl, new THREE.Matrix4());

        this.normal = data.normal;
        this.offset = data.offset;
        this.vertices = data.vertices;
        this.color = data.color !== undefined ? data.color : [255, 255, 255, 255];
        this.name = data.name !== undefined ? data.name : "Element";
        this.id = data.id !== undefined ? data.id : CADModel.generate_unique_id();
    }

    init(){
        //TODO: refactor so that we can 
        //          - make a new PlanarPolygon without normal, offset, vertices (placeholder for case of less than or equal to three verts)
        //          - update PlanarPolygon with new points (or make a PP metadata class)

        if (this.vertices.length >= 3){
            this.planar_vertices = this.vertices.map(v => this.project_point(v), this);
            this.init_shaders();
            this.init_model();
            this.upload_data();
        }
    }

    init_model(){
        // Flatten array of vertex components [Vec3(x1,y1,z1), ...] --> [x1, y1, z1, ...]
        this.positions = Array.prototype.concat.apply([], this.planar_vertices.map(v => v.toArray()));

        // Same normal for each vertex
        this.normals = Array.prototype.concat.apply([], Array(this.positions.length).fill(this.normal.toArray()));

        // Rotate so plane is parallel to XY-plane, and orthogonally project,
        //  then triangulate in 2D
        let R = geometry.rotation_matrix_aligning_two_vectors(this.normal, new THREE.Vector3(0, 0, 1));
        this.indices = PlanarPolygon.triangulate3d(
                            Array.prototype.concat.apply([], this.planar_vertices.map(v => v.clone().applyMatrix4(R).toArray()))
                       );
        this.vao.n_positions = this.indices.length;
    }

    set_name(new_name){
        this.name = new_name;
    }

    add_vertex(vertex){
        // Vertex should be a THREE.Vector3 instance
        this.vertices.push(vertex);
        
        let X, y, w;

        /***  Recompute plane (model matrix) ***/
        // Perform linear regression with given points as rows of the design matrix
        if (this.vertices.length >= 3 ){
            let flat_verts = [];
            
            for (let i = 0; i < this.vertices.length; i++){
                this.vertices[i].toArray(flat_verts, i * 3);
            }

            X = mathjs.matrix(flat_verts);
            X.reshape([~~(flat_verts.length / 3), 3]);

            y = mathjs.subset(X, mathjs.index(mathjs.range(0, X.size()[0]), 2));
            X = mathjs.resize(X, [X.size()[0], 2]);

            X = mathjs.concat(mathjs.ones(X.size()[0], 1), X);

            w = mathjs.multiply(mathjs.inv(mathjs.multiply(mathjs.transpose(X), X)), 
                                mathjs.multiply(mathjs.transpose(X), y));
        }

    }

    project_point(point){
        return geometry.project_point_onto_plane(point, this.normal, this.offset);
    }

    set_model_matrix(){

    }

    static triangulate2d(vertices){
        // Vertices must be 2d, in a flat array, i.e. [x1,y1, x2,y2, ...]
        return earcut(vertices);
    }

    static triangulate3d(vertices){
        // Vertices must be 3d in a flat array, i.e. [x1,y1,z1, x2,y2,z2, ...]
        // Orthogonally project vertices onto XY-plane by removing z-coord
        // This means that the z-coord should be zero, otherwise the shape will be distorted
        return PlanarPolygon.triangulate2d(vertices.filter((_, i) => (i + 1) % 3 !== 0));
    }

    static build_model_matrix(normal, vertices){
        /***  Find model matrix for new plane  ***/
        // Find axis of rotation
        let axis = (new THREE.Vector3()).crossVectors(PlanarPolygon.normal, normal).normalize();

        // Find angle between default plane and normal
        // We don't need to divide by the magnitude of n since it's been normalized
        // PlanarPolygon.normal has also been defined as a unit vector, but relying on that introduces hidden coupling
        let angle = Math.acos(PlanarPolygon.normal.dot(normal) / PlanarPolygon.normal.distanceTo(new THREE.Vector3(0,0,0)));

        // Find offset
        let c = new THREE.Vector3(0,0,0);  // Center of new rect

        // Get centroid of the 3 markers
        for (let i = 0; i < 3; i++){
            c.add([cm1, cm2, cm3][i].position());
        }

        c.divideScalar(3);
        c.sub(PlanarPolygon.center);

        // Build model matrix for new plane
        let m = (new THREE.Matrix4()).makeRotationAxis(axis, angle);
        m.setPosition(c);
    }

    as_rect_containing_points(gl, normal, offset, points){
        let planar_points = points.map(p => geometry.project_point_onto_plane(p, normal, offset));
        // Get bbox
        //    i) Pick point in plane for first basis vector
        let b1 = planar_points[0].clone().sub(offset).normalize();

        //    ii) Cross product with normal for second basis vector
        let b2 = (new THREE.Vector3).crossVectors(normal, b1).normalize();
        //    iii) Find mins/maxes in direction of each basis vector
        let max1 = -Infinity, max2 = -Infinity,
            min1 = Infinity, min2 = Infinity,
            b1p, b2p;

        for (let p of planar_points.map(p => p.clone().sub(offset))){
            b1p = b1.dot(p);
            b2p = b2.dot(p);

            max1 = Math.max(max1, b1p);
            min1 = Math.min(min1, b1p);
            max2 = Math.max(max2, b2p);
            min2 = Math.min(min2, b2p);
        }
        let corners = [
            b1.clone().multiplyScalar(max1).add(b2.clone().multiplyScalar(max2)),
            b1.clone().multiplyScalar(max1).add(b2.clone().multiplyScalar(min2)),
            b1.clone().multiplyScalar(min1).add(b2.clone().multiplyScalar(min2)),
            b1.clone().multiplyScalar(min1).add(b2.clone().multiplyScalar(max2))]
            
        let offset_corners = corners.map(c => c.clone().add(offset));
        this.normal = normal;
        this.offset = offset;
        this.vertices = offset_corners;
        this.init();
        // return new PlanarPolygon(gl, normal, offset, offset_corners);
    }

    toJSON(key){
        return this.normal === undefined ? {} : {
            name: this.name,
            color: this.color,
            normal: this.normal.toArray(),
            offset: this.offset.toArray(),
            normal_threshold: null,
            point_2_plane_threshold: null
        };
    }
}

export { CADModel, Cube, Rect, PlanarPolygon };