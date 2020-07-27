/*
    Shader for reading depth and normal from a mesh
*/

export const DepthNormalVS = `#version 300 es
            precision lowp float;

            layout(location = 0) in vec3 position;
            layout(location = 1) in vec3 normal;

            uniform mat4 model_matrix;
            uniform mat4 view_matrix;
            uniform mat4 projection_matrix;

            out vec3 normal_vs;

            void main() {
                gl_Position = projection_matrix * view_matrix * model_matrix * vec4(position, 1.0);

                mat4 normal_matrix = transpose(inverse(model_matrix));  //TODO: precalculate normal_matrix
                normal_vs = normalize(vec3(normal_matrix * vec4(normal, 0)));
            }`;

export const DepthNormalFS = `#version 300 es
            precision lowp float;

            in vec3 normal_vs;

            layout(location = 0) out vec4 dummy;
            layout(location = 1) out vec4 depth;
            layout(location = 2) out vec4 normal_x;
            layout(location = 3) out vec4 normal_y;
            layout(location = 4) out vec4 normal_z;

            void main() {
                dummy = vec4(0);

                // Store depth (float) in first 24 bits of RGBA tuple
                int z_linear_int = int(gl_FragCoord.z * float(1 << 24));
                int r1 = (z_linear_int & 0x000000FF) >> 0;
                int g1 = (z_linear_int & 0x0000FF00) >> 8;
                int b1 = (z_linear_int & 0x00FF0000) >> 16;
                depth = vec4(float(r1)/255.0, float(g1)/255.0, float(b1)/255.0, 1.0);

                // Store normal in 3 RGBA tuples (one tuple per component)
                // f(x) = (x + 1) / 2  =>  f : [-1, 1] -> [0, 1] 
                // This is important b/c we are storing floating point numbers as uints
                int nx_int = int((normal_vs.x + 1.0) / 2.0 * float(1 << 24));
                int nxr = (nx_int & 0x000000FF) >> 0;
                int nxg = (nx_int & 0x0000FF00) >> 8;
                int nxb = (nx_int & 0x00FF0000) >> 16;
                normal_x = vec4(float(nxr)/255.0, float(nxg)/255.0, float(nxb)/255.0, 1.0);

                int ny_int = int((normal_vs.y + 1.0) / 2.0 * float(1 << 24));
                int nyr = (ny_int & 0x000000FF) >> 0;
                int nyg = (ny_int & 0x0000FF00) >> 8;
                int nyb = (ny_int & 0x00FF0000) >> 16;
                normal_y = vec4(float(nyr)/255.0, float(nyg)/255.0, float(nyb)/255.0, 1.0);

                int nz_int = int((normal_vs.z + 1.0) / 2.0 * float(1 << 24));
                int nzr = (nz_int & 0x000000FF) >> 0;
                int nzg = (nz_int & 0x0000FF00) >> 8;
                int nzb = (nz_int & 0x00FF0000) >> 16;
                normal_z = vec4(float(nzr)/255.0, float(nzg)/255.0, float(nzb)/255.0, 1.0);
            }`;


export const VertexIdVS = `#version 300 es
            precision lowp float;

            layout(location = 0) in vec3 position;
            layout(location = 1) in vec3 normal;

            uniform mat4 model_matrix;
            uniform mat4 view_matrix;
            uniform mat4 projection_matrix;

            out vec3 normal_vs;

            void main() {
                gl_Position = projection_matrix * view_matrix * model_matrix * vec4(position, 1.0);

                mat4 normal_matrix = transpose(inverse(model_matrix));  //TODO: precalculate normal_matrix
                normal_vs = normalize(vec3(normal_matrix * vec4(normal, 0)));
            }`;

export const VertexIdFS = `#version 300 es
            precision lowp float;

            in int vertexID_vs;

            layout(location = 0) out vec4 dummy;
            layout(location = 1) out vec4 vertexID;

            void main() {
                dummy = vec4(0);

                // Store depth (float) in first 24 bits of RGBA tuple
                int z_linear_int = int(gl_FragCoord.z * float(1 << 24));
                int r1 = (z_linear_int & 0x000000FF) >> 0;
                int g1 = (z_linear_int & 0x0000FF00) >> 8;
                int b1 = (z_linear_int & 0x00FF0000) >> 16;
                vertexID = vec4(float(r1)/255.0, float(g1)/255.0, float(b1)/255.0, 1.0);
            }`;