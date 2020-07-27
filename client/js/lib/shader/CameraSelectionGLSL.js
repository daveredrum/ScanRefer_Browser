export const VS = `#version 300 es
        precision mediump float;

        uniform mat4 model_matrix;
        uniform mat4 view_matrix;
        uniform mat4 projection_matrix;

        uniform float scale;

        layout (location = 0) in vec3 vertex;

        void main() {
            mat4 mvp_matrix = projection_matrix * view_matrix * model_matrix; 
            gl_Position =  mvp_matrix * vec4(scale * vertex, 1.0);
        }
`;

export const FS = `#version 300 es
    precision mediump float;

    layout(location = 0) out vec4 frag_color;
    layout(location = 1) out vec4 enc_obj_id;

    uniform int obj_id;

    uniform vec4 color;

    void main() {
        frag_color = color;
        enc_obj_id = vec4(1.0, float(obj_id % 256) / 255.0, float((obj_id / 256)) / 255.0, 1.0);
    }

`;
