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

	out vec4 frag_color;

	void main() {
		frag_color = texture(sampler, uv_vs);
	}
`;