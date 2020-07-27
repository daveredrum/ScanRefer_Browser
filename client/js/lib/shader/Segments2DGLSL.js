export const VS = `#version 300 es
    precision mediump float;
    layout (location = 0) in vec2 position;
    layout (location = 1) in vec2 uv;

    out vec2 uv_vs;

    void main() {
        gl_Position = vec4(position, 0.0, 1.0);
        uv_vs = uv;
    }
`;

export const FS = `#version 300 es
    precision mediump float;

    in vec2 uv_vs;
    uniform sampler2D sampler;
    uniform vec4 colors[{0}];
    layout(location = 0) out vec4 frag_color;
    layout(location = 1) out vec4 out_segment_id;

    void main() {
        vec4 segment_color = texture(sampler, uv_vs);
        frag_color = colors[int(segment_color[0] * 255.0 + segment_color[1] * 255.0 * 256.0 + segment_color[2] * 255.0 * 256.0)];
        out_segment_id = vec4(segment_color[0], segment_color[1], segment_color[2], 1.0);
    }
`;