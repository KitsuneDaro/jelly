import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.162/build/three.module.js';

////////////////////////////////////////////////////////////
// 基本設定
////////////////////////////////////////////////////////////

const scene = new THREE.Scene();
const cameraScale = 10;

let minScreenSize = Math.min(window.innerWidth, window.innerHeight);
let cameraWidth = cameraScale * window.innerWidth / minScreenSize;
let cameraHeight = cameraScale * window.innerHeight / minScreenSize;
let screenSize = new THREE.Vector3(cameraWidth, cameraHeight, 0);

const camera = new THREE.OrthographicCamera(
    -screenSize.x / 2,
    screenSize.x / 2,
    screenSize.y / 2,
    -screenSize.y / 2,
    0.1,
    100
);

camera.position.z = 10;

const renderer = new THREE.WebGLRenderer({
    antialias: true
});

renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

////////////////////////////////////////////////////////////
// 定数
////////////////////////////////////////////////////////////

const dt = 1 / 60;

const k0 = 500.0;
const k1 = 100.0;
const k2 = 1.0;
const k3 = 10.0;
const k4 = 2.0;
const k5_1 = 300.0;
const k5_2 = 1 / 0.5;
const gravityForce = new THREE.Vector3(0, -10, 0);

const pos_o_resilience = 1;//0.91667;

////////////////////////////////////////////////////////////
// 変数
////////////////////////////////////////////////////////////

let N_v = 0;

let pos_v0 = [];
let pos_v = [];
let vel_v = [];
let normal_v0 = [];
let normal_v = [];
let tangent_v0 = [];
let F_v = [];

let normal_e0 = [];
let normal_e = [];
let length_e0 = [];
let length_e = [];

let pos_o = new THREE.Vector3();
let vel_o = new THREE.Vector3();
let angle_o = 0.0;
let angle_vel_o = 0.0;
let area_o0 = 0.0;

////////////////////////////////////////////////////////////
// マウス掴み
////////////////////////////////////////////////////////////

const mouse = new THREE.Vector2();

let grabbedVertex = -1;
let grabOffset = new THREE.Vector3();

////////////////////////////////////////////////////////////
// Utility
////////////////////////////////////////////////////////////

function dot(a, b) {
    return a.dot(b);
}

function cross(a, b) {
    return new THREE.Vector3().crossVectors(a, b);
}

function length(v) {
    return v.length();
}

function norm(v) {
    return v.clone().normalize();
}

function pre(i) {
    return (i - 1 + N_v) % N_v;
}

function next(i) {
    return (i + 1) % N_v;
}

////////////////////////////////////////////////////////////
// Geometry
////////////////////////////////////////////////////////////

let geometry;
let mesh;
let texture = new THREE.TextureLoader().load(
    './data/reimu.png~'
);
// const deformTarget =
//     new THREE.WebGLRenderTarget(
//         1024,
//         1024,
//         {
//             type: THREE.FloatType,
//             minFilter: THREE.LinearFilter,
//             magFilter: THREE.LinearFilter,
//             depthBuffer: false,
//             stencilBuffer: false
//         }
//     );
// const restPositions = [];

//     const deformMaterial =
//     new THREE.ShaderMaterial({

//         vertexShader: `

//             attribute vec2 restPosition;

//             varying vec2 vRestPos;

//             void main() {

//                 vRestPos = restPosition;

//                 gl_Position =
//                     projectionMatrix *
//                     modelViewMatrix *
//                     vec4(position,1.0);
//             }
//         `,

//         fragmentShader: `

//             varying vec2 vRestPos;

//             uniform vec2 uMin;
//             uniform vec2 uMax;

//             void main() {

//                 ////////////////////////////////////////////////////
//                 // rest座標を0-1へ正規化
//                 ////////////////////////////////////////////////////

//                 vec2 uv =
//                     (vRestPos - uMin)
//                     / (uMax - uMin);

//                 ////////////////////////////////////////////////////
//                 // RGBへ保存
//                 ////////////////////////////////////////////////////

//                 gl_FragColor =
//                     vec4(uv,0.0,1.0);
//             }
//         `,

//         uniforms: {

//             uMin: {
//                 value: new THREE.Vector2()
//             },

//             uMax: {
//                 value: new THREE.Vector2()
//             }
//         }
//     });
//     const renderMaterial =
//     new THREE.ShaderMaterial({

//         uniforms: {

//             uImage: {
//                 value: imageTexture
//             },

//             uDeform: {
//                 value: deformTarget.texture
//             }
//         },

//         vertexShader: `

//             varying vec2 vScreenUv;

//             void main() {

//                 vec4 clip =
//                     projectionMatrix *
//                     modelViewMatrix *
//                     vec4(position,1.0);

//                 gl_Position = clip;

//                 ////////////////////////////////////////////////////
//                 // screen uv
//                 ////////////////////////////////////////////////////

//                 vScreenUv =
//                     clip.xy / clip.w * 0.5 + 0.5;
//             }
//         `,

//         fragmentShader: `

//             uniform sampler2D uImage;
//             uniform sampler2D uDeform;

//             varying vec2 vScreenUv;

//             void main() {

//                 ////////////////////////////////////////////////////
//                 // deformation mapから
//                 // 元位置取得
//                 ////////////////////////////////////////////////////

//                 vec2 restUv =
//                     texture2D(
//                         uDeform,
//                         vScreenUv
//                     ).xy;

//                 ////////////////////////////////////////////////////
//                 // 元画像参照
//                 ////////////////////////////////////////////////////

//                 vec4 color =
//                     texture2D(
//                         uImage,
//                         restUv
//                     );

//                 gl_FragColor = color;
//             }
//         `,

//         transparent: true
//     });

// const deformMesh =
//     new THREE.Mesh(
//         geometry,
//         deformMaterial
//     );

// const renderMesh =
//     new THREE.Mesh(
//         geometry,
//         renderMaterial
//     );

function createMesh() {

    geometry = new THREE.BufferGeometry();

    updateGeometry();

    const material = new THREE.ShaderMaterial({

        uniforms: {

            uTexture: {
                value: texture
            }
        },

        vertexShader: `

            attribute vec2 displacement;

            varying vec2 vUv;
            varying vec2 vDisplacement;

            void main() {

                vUv = uv;

                ////////////////////////////////////////////////////
                // displacementをfragmentへ渡す
                ////////////////////////////////////////////////////

                vDisplacement = displacement;

                gl_Position =
                    projectionMatrix *
                    modelViewMatrix *
                    vec4(position, 1.0);
            }
        `,

        fragmentShader: `

            uniform sampler2D uTexture;

            varying vec2 vUv;
            varying vec2 vDisplacement;

            void main() {

                ////////////////////////////////////////////////////
                // backward mapping
                ////////////////////////////////////////////////////

                vec2 sourceUv =
                    vUv - vDisplacement;

                vec4 color =
                    texture2D(
                        uTexture,
                        sourceUv
                    );

                gl_FragColor = color;
            }
        `,

        side: THREE.DoubleSide

    });

    mesh = new THREE.Mesh(
        geometry,
        material
    );
    scene.add(mesh);

    // scene.add(renderMesh);
}

function updateGeometry() {

    const vertices = [];
    const uvs = [];
    const displacements = [];

    ////////////////////////////////////////////////////////
    // UV用BBox
    ////////////////////////////////////////////////////////

    // vertex_data.datの時点で既に大きさは揃えられているため、求める必要はなし
    let minX = -1;
    let maxX = 1;
    let minY = -1;
    let maxY = 1;

    const sizeX = maxX - minX;
    const sizeY = maxY - minY;

    ////////////////////////////////////////////////////////
    // 頂点生成
    ////////////////////////////////////////////////////////

    for (let i = 0; i < N_v; i++) {

        ////////////////////////////////////////////////////
        // position
        ////////////////////////////////////////////////////

        vertices.push(
            pos_v[i].x,
            pos_v[i].y,
            0
        );

        // restPositions.push(
        //     pos_v0[i].x,
        //     pos_v0[i].y
        // );

        ////////////////////////////////////////////////////
        // uv
        ////////////////////////////////////////////////////

        const u =
            (pos_v0[i].x - minX) / sizeX;

        const v =
            (pos_v0[i].y - minY) / sizeY;

        uvs.push(u, v);

        ////////////////////////////////////////////////////
        // displacement
        ////////////////////////////////////////////////////

        const displacement =
            pos_v[i]
                .clone()
                .sub(pos_o)
                .sub(pos_v0[i]);

        ////////////////////////////////////////////////////
        // UV空間へ変換
        ////////////////////////////////////////////////////

        displacements.push(
            displacement.x / sizeX,
            displacement.y / sizeY
        );
    }

    ////////////////////////////////////////////////////////
    // index
    ////////////////////////////////////////////////////////

    const indices = [];

    for (let i = 1; i < N_v - 1; i++) {

        indices.push(0, i, i + 1);
    }

    geometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(vertices, 3)
    );

    geometry.setAttribute(
        'uv',
        new THREE.Float32BufferAttribute(uvs, 2)
    );

    geometry.setAttribute(
        'displacement',
        new THREE.Float32BufferAttribute(displacements, 2)
    );

    // geometry.setAttribute(
    //     'restPosition',
    //     new THREE.Float32BufferAttribute(
    //         restPositions,
    //         2
    //     )
    // );

    geometry.setIndex(indices);

    geometry.computeVertexNormals();

    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.uv.needsUpdate = true;
    geometry.attributes.displacement.needsUpdate = true;
}

////////////////////////////////////////////////////////////
// 面積
////////////////////////////////////////////////////////////

function computeAllArea(vertices) {

    let area_o = 0;

    for (let i = 0; i < N_v; i++) {
        area_o += computeEdgeArea(vertices, i);
    }

    return area_o;
}

function computeEdgeArea(vertices, i) {
    return computeArea(
        vertices[i],
        vertices[next(i)]
    );
}

function computeArea(a, b) {
    return 0.5 * cross(a, b).z;
}

////////////////////////////////////////////////////////////
// 辺法線
////////////////////////////////////////////////////////////

function computeEdgeNormals(vertices, normal_e) {
    let normals = [];
    let lengths = [];

    for (let i = 0; i < N_v; i++) {

        const p0 = vertices[i];
        const p1 = vertices[next(i)];

        const edge = p1.clone().sub(p0);

        const len = edge.length();

        lengths.push(len);

        let n = new THREE.Vector3(
            edge.y,
            -edge.x,
            0
        ).normalize();

        if (len == 0.0) {
            n = normal_e[i]
        }

        normals.push(n);
    }

    return {
        normals,
        lengths
    };
}

////////////////////////////////////////////////////////////
// 頂点法線
////////////////////////////////////////////////////////////

function computeVertexNormals(edgeNormals, edgeLengths, normal_v) {

    let result = [];

    for (let i = 0; i < N_v; i++) {

        if (edgeLengths[pre(i)] == 0.0 || edgeLengths[pre(i)] == 0.0) {
            result.push(normal_v[i]);
            continue;
        }

        const a =
            edgeNormals[pre(i)]
                .clone()
                .multiplyScalar(edgeLengths[pre(i)]);

        const b =
            edgeNormals[i]
                .clone()
                .multiplyScalar(edgeLengths[i]);

        const n =
            a.add(b)
             .divideScalar(
                edgeLengths[pre(i)] + edgeLengths[i]
             )
             .normalize();

        result.push(n);
    }

    return result;
}

////////////////////////////////////////////////////////////
// 頂点角度
////////////////////////////////////////////////////////////

function computeAngles(edgeNormals) {

    let t = [];

    for (let i = 0; i < N_v; i++) {

        const c =
            cross(
                edgeNormals[pre(i)],
                edgeNormals[i]
            ).z;

        const d =
            dot(
                edgeNormals[pre(i)],
                edgeNormals[i]
            );

        t.push(c / d);
    }

    return t;
}

////////////////////////////////////////////////////////////
// 初期化
////////////////////////////////////////////////////////////

async function init() {

    const response =
        await fetch('./data/vertex_data.dat');

    const buffer =
        await response.arrayBuffer();

    const array =
        new Float32Array(buffer);

    N_v = array.length / 2;

    for (let i = 0; i < N_v; i++) {

        const x = array[i * 2 + 0];
        const y = array[i * 2 + 1];

        const v = new THREE.Vector3(x, y, 0);

        pos_v.push(v.clone());
        pos_v0.push(v.clone());

        vel_v.push(new THREE.Vector3());

        F_v.push(new THREE.Vector3());
    }

    const edgeData =
        computeEdgeNormals(pos_v);

    normal_e0 = edgeData.normals;
    normal_e = normal_e0;
    length_e0 = edgeData.lengths;
    length_e = length_e0;

    normal_v0 = computeVertexNormals(normal_e0, length_e0);
    normal_v = normal_v0;

    tangent_v0 = computeAngles(normal_e0);

    area_o0 = computeAllArea(pos_v0);

    createMesh();

    animate();
}

////////////////////////////////////////////////////////////
// 力計算
////////////////////////////////////////////////////////////

function resilienceForce(k, pos_v, pos_v0, pos_o, angle_o, i) {
    const f = pos_v[i].clone()
        .sub(pos_v0[i].clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), angle_o).add(pos_o))
        .multiplyScalar(-k);
    
    // if (length(f) > 1) {
        return f;
    // } else {
    //     return new THREE.Vector3();
    // }
}

function edgeSpringForce(k, pos_v, length_e, length_e0, i) {
    const term1 =
    pos_v[i]
    .clone()
    .sub(pos_v[pre(i)])
    .multiplyScalar(
        length_e[pre(i)] - length_e0[pre(i)]
    );

    const term2 =
        pos_v[i]
        .clone()
        .sub(pos_v[next(i)])
        .multiplyScalar(
            length_e[i] - length_e0[i]
        );

    return term1
        .add(term2)
        .multiplyScalar(-k);
}

function vertexSpringForce(k, tangent_v, tangent_v0, normal_v, i) {
    return normal_v[i]
        .clone()
        .multiplyScalar(
            -k * Math.atan(
                (tangent_v[i] - tangent_v0[i]) *
                (1 + tangent_v[i] * tangent_v0[i])
            ) / Math.PI
        );
}

function meshSpringForce(k, area, area0, normal_v, i) {
    return normal_v[i]
        .clone()
        .multiplyScalar(
            -k *
            (area - area0) *
            dt
        );
}

function dampingForce(c, vel_v, i) {
    return vel_v[i]
        .clone()
        .multiplyScalar(-c);
}

function originalMouceGrabbingForce(k, grabbedVertex, grabOffset, pos_v) {
    if (grabbedVertex == -1) {
        return new THREE.Vector3();
    }

    const world =
    new THREE.Vector3(mouse.x, mouse.y, 0)
        .unproject(camera);

    const target =
        world.clone().add(grabOffset);

    return target.clone().sub(pos_v[grabbedVertex]).multiplyScalar(k);
}

function mouceGrabbingForce(k, grabbedVertex, grabbingForce, pos_v, i) {
    if (grabbedVertex == -1) {
        return new THREE.Vector3();
    }

    return grabbingForce.clone().multiplyScalar(Math.exp(-(k * length(pos_v[i].clone().sub(pos_v[grabbedVertex])) ** 2)));
}

function coordinateClamp(pos, range) {
    return new THREE.Vector3(clamp(pos.x, range.x), clamp(pos.y, range.y), 0)
}

function clamp(x, range) {
    return Math.max(Math.min(x, range / 2.0), -range / 2.0)
}

function updatePhysics() {
    const area_o =
        computeAllArea(pos_v);

    const edgeData =
        computeEdgeNormals(pos_v, normal_e);

    normal_e = edgeData.normals;
    length_e = edgeData.lengths;

    normal_v =
        computeVertexNormals(
            normal_e,
            length_e,
            normal_v
        );

    const tangent_v =
        computeAngles(normal_e);
    
    const grabbingForce =
        originalMouceGrabbingForce(k5_1, grabbedVertex, grabOffset, pos_v);

    for (let i = 0; i < N_v; i++) {
        const F0 = resilienceForce(k0, pos_v, pos_v0, pos_o, angle_o, i);
        const F1 = edgeSpringForce(k1, pos_v, length_e, length_e0, i);
        const F2 = vertexSpringForce(k2, tangent_v, tangent_v0, normal_v, i);
        const F3 = meshSpringForce(k3, area_o, area_o0, normal_v, i)
        const F4 = dampingForce(k4, vel_v, i)
        const F5 = mouceGrabbingForce(k5_2, grabbedVertex, grabbingForce, pos_v, i);

        // ////////////////////////////////////////////////////
        // // 合計
        // ////////////////////////////////////////////////////

        F_v[i] =
            new THREE.Vector3()
            .add(F0)
            .add(F1)
            .add(F2)
            .add(F3)
            .add(F4)
            .add(F5)
            .add(gravityForce);
    }

    ////////////////////////////////////////////////////////
    // 速度更新
    ////////////////////////////////////////////////////////

    for (let i = 0; i < N_v; i++) {
        vel_v[i].add(
            F_v[i]
            .clone()
            .multiplyScalar(dt)
        );

        vel_o.add(vel_v[i]);
    }
    vel_o.divideScalar(N_v);

    ////////////////////////////////////////////////////////
    // 座標更新
    ////////////////////////////////////////////////////////

    const old_mean_pos_v = new THREE.Vector3();
    const new_mean_pos_v = new THREE.Vector3();

    for (let i = 0; i < N_v; i++) {
        old_mean_pos_v.add(pos_v[i]);

        pos_v[i].add(
            vel_v[i]
            .clone()
            .multiplyScalar(dt)
        );

        pos_v[i] = coordinateClamp(pos_v[i], screenSize);
        new_mean_pos_v.add(pos_v[i]);
    }
    // vel_o.clone()
    pos_o.add(new_mean_pos_v.divideScalar(N_v).sub(old_mean_pos_v.divideScalar(N_v)).multiplyScalar(pos_o_resilience));

    //angle_o += dt;
}


////////////////////////////////////////////////////////
// renderer更新
////////////////////////////////////////////////////////
function updateScreenSize() {
    minScreenSize = Math.min(window.innerWidth, window.innerHeight);
    renderer.setSize(window.innerWidth, window.innerHeight);

    updateCamera();
}

function updateCamera() {
    let cameraWidth = cameraScale * window.innerWidth / minScreenSize;
    let cameraHeight = cameraScale * window.innerHeight / minScreenSize;
    screenSize = new THREE.Vector3(cameraWidth, cameraHeight, 0);
    
    camera.left = -screenSize.x / 2;
    camera.right = screenSize.x / 2;
    camera.top = screenSize.y / 2;
    camera.bottom = -screenSize.y / 2;
    
    camera.updateProjectionMatrix();
}

window.addEventListener('resize', updateScreenSize)

renderer.domElement.addEventListener(
    'mousedown',
    (e) => {
        mouse.x =
            (e.clientX / window.innerWidth) * 2 - 1;

        mouse.y =
            -(e.clientY / window.innerHeight) * 2 + 1;

        const world =
            new THREE.Vector3(mouse.x, mouse.y, 0)
                .unproject(camera);

        let bestDist = Infinity;

        for (let i = 0; i < N_v; i++) {
            const d =
                pos_v[i].distanceTo(world);

            if (d < bestDist) {
                bestDist = d;
                grabbedVertex = i;

                grabOffset =
                    pos_v[i].clone().sub(world);
            }
        }
    }
);

renderer.domElement.addEventListener(
    'mouseup',
    () => {
        grabbedVertex = -1;
    }
);

renderer.domElement.addEventListener(
    'mouseout',
    () => {
        grabbedVertex = -1;
    }
);

renderer.domElement.addEventListener(
    'mouseleave',
    () => {
        grabbedVertex = -1;
    }
);

renderer.domElement.addEventListener(
    'mousemove',
    (e) => {
        mouse.x =
            (e.clientX / window.innerWidth) * 2 - 1;

        mouse.y =
            -(e.clientY / window.innerHeight) * 2 + 1;
    }
);

////////////////////////////////////////////////////////////
// Loop
////////////////////////////////////////////////////////////

function animate() {

    requestAnimationFrame(animate);

    updatePhysics();

    updateGeometry();

    renderer.render(scene, camera);
}
// function animate() {

//     requestAnimationFrame(animate);

//     updatePhysics();

//     updateGeometry();

//     ////////////////////////////////////////////////////////
//     // Pass1
//     // deformation map生成
//     ////////////////////////////////////////////////////////

//     renderer.setRenderTarget(
//         deformTarget
//     );

//     renderer.render(
//         new THREE.Scene().add(deformMesh),
//         camera
//     );

//     ////////////////////////////////////////////////////////
//     // Pass2
//     // 本描画
//     ////////////////////////////////////////////////////////

//     renderer.setRenderTarget(renderMesh);

//     renderer.render(scene, camera);
// }

init();