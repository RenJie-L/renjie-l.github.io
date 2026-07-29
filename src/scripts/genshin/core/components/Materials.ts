import {
  Color,
  LinearMipmapLinearFilter,
  MeshPhysicalMaterial,
  Plugin,
  RepeatWrapping,
  ShaderMaterial,
  Texture,
  TextureLoader,
  WebGLRenderer,
} from '../../libs/xviewer';
import { GENSHIN_ASSETS } from '../../AssetManifest';

import { ACES_fog_fragment } from '../../shader/chunk/ACES_fog_fragment.chunk';
import { RE_Direct_ToonPhysical } from '../../shader/chunk/RE_Direct_ToonPhysical.chunk';
import { RE_Direct_ToonPhysical_Road } from '../../shader/chunk/RE_Direct_ToonPhysical.chunk_Road';
import { lights_fragment_beginToon } from '../../shader/chunk/lights_fragment_beginToon';
import { frag as bigCloud } from '../../shader/fragment/BigCloud.frag';
import { frag as bigCloudBG } from '../../shader/fragment/BigCloudBG.frag';
import { frag as cloudFrag } from '../../shader/fragment/cloud.frag';
import { frag as hashFogFrag } from '../../shader/fragment/hashFog.frag';
import { frag as polarLightFrag } from '../../shader/fragment/polarLight.frag';
import { vert as cloudVert } from '../../shader/vertex/cloud.vert';
import { vert as simpleVert } from '../../shader/vertex/simple.vert';

interface TrackedTexture {
  name: string;
  texture: Texture;
  ready: Promise<void>;
}

function loadTrackedTexture(name: string, url: string): TrackedTexture {
  const loader = new TextureLoader();
  let texture!: Texture;
  const ready = new Promise<void>((resolve, reject) => {
    texture = loader.load(url, () => resolve(), undefined, reject);
  }).catch((error) => {
    throw new Error(`Failed to load Genshin texture "${name}"`, {
      cause: error,
    });
  });

  return { name, texture, ready };
}

const cloudTexture = loadTrackedTexture(
  'cloud-mask',
  GENSHIN_ASSETS.textures.cloudMask,
);
const bigCloudTexture = loadTrackedTexture(
  'big-cloud',
  GENSHIN_ASSETS.textures.bigCloud,
);
const bigCloudBackgroundTexture = loadTrackedTexture(
  'big-cloud-background',
  GENSHIN_ASSETS.textures.bigCloudBackground,
);
const polarLightTexture = loadTrackedTexture(
  'polar-light',
  GENSHIN_ASSETS.textures.polarLight,
);
const starTexture = loadTrackedTexture('star', GENSHIN_ASSETS.textures.star);

export const materialTextureTasks = [
  cloudTexture,
  bigCloudTexture,
  bigCloudBackgroundTexture,
  polarLightTexture,
  starTexture,
].map(({ name, ready }) => ({ name, ready }));

export const texture_Cloud = cloudTexture.texture;
export const M_Cloud = new ShaderMaterial({
  uniforms: {
    cloudTexture: { value: texture_Cloud },
    color_1: { value: new Color('#00a2f0') },
    color_intensity_1: { value: 1 },
    color_2: { value: new Color('#f0f0f5') },
    color_intensity_2: { value: 1 },
  },
  fragmentShader: cloudFrag,
  vertexShader: cloudVert,
  transparent: true,
  depthWrite: false,
});
export const texture_Cloud0 = bigCloudTexture.texture;
export const M_BigCloud = new ShaderMaterial({
  uniforms: {
    cloudTexture: { value: texture_Cloud0 },
  },
  fragmentShader: bigCloud,
  vertexShader: simpleVert,
  transparent: true,
  depthWrite: false,
});
export const texture_Cloud1 = bigCloudBackgroundTexture.texture;
export const M_BigCloudBG = new ShaderMaterial({
  uniforms: {
    cloudTexture: { value: texture_Cloud1 },
  },
  fragmentShader: bigCloudBG,
  vertexShader: simpleVert,
  transparent: true,
  depthWrite: false,
});

export const M_HashFog = new ShaderMaterial({
  uniforms: {
    time: { value: 123 },
  },
  fragmentShader: hashFogFrag,
  vertexShader: simpleVert,
  transparent: true,
  depthWrite: false,
});

export const texture_Light = polarLightTexture.texture;
texture_Light.wrapS = RepeatWrapping;
texture_Light.wrapT = RepeatWrapping;
export const texture_Star = starTexture.texture;
export const M_PolarLight = new ShaderMaterial({
  uniforms: {
    lightTexture: { value: texture_Light },
    time: { value: 123 },
  },
  fragmentShader: polarLightFrag,
  vertexShader: simpleVert,
  transparent: true,
  depthWrite: false,
});

export class ToonMaterials {
  public getToonMaterial_Column(originMaterial: MeshPhysicalMaterial) {
    originMaterial.metalness = 0.3;
    originMaterial.onBeforeCompile = function (shader) {
      let fragment = shader.fragmentShader;
      fragment = fragment.replace(
        '#include <lights_physical_pars_fragment>',
        `
            #include <lights_physical_pars_fragment>
            vec3 fresnelCol = vec3(0x11,0x2e,0xae)/255.*5.;
            ${RE_Direct_ToonPhysical}
            `,
      );
      fragment = fragment.replace(
        '#include <lights_fragment_begin>',
        `
            ${lights_fragment_beginToon}
            `,
      );
      fragment = fragment.replace(
        '#include <fog_fragment>',
        `
            ${ACES_fog_fragment}
            `,
      );
      shader.fragmentShader = fragment;
    };
    return originMaterial;
  }
  public getToonMaterial_Road(
    originMaterial: MeshPhysicalMaterial,
    renderer: WebGLRenderer,
  ) {
    originMaterial.color.multiply(
      new Color('#fffcfe').add(new Color().setRGB(0.015, 0, 0)),
    );
    if (originMaterial.normalMap) {
      originMaterial.normalMap.minFilter = LinearMipmapLinearFilter;
      originMaterial.normalMap.anisotropy =
        renderer.capabilities.getMaxAnisotropy() / 2;
    }
    if (originMaterial.roughnessMap) {
      originMaterial.roughnessMap.anisotropy =
        renderer.capabilities.getMaxAnisotropy() / 2;
    }
    if (originMaterial.map) {
      originMaterial.map.anisotropy =
        renderer.capabilities.getMaxAnisotropy() / 2;
    }
    originMaterial.roughness = 5;
    originMaterial.metalness = 0;
    originMaterial.onBeforeCompile = function (shader) {
      let fragment = shader.fragmentShader;
      fragment = fragment.replace(
        '#include <lights_physical_pars_fragment>',
        `
            #include <lights_physical_pars_fragment>
            //vec3 fresnelCol = vec3(254., 103., 57.)/255.;
            vec3 fresnelCol = vec3(0.)/255.;
            ${RE_Direct_ToonPhysical_Road}
            `,
      );
      fragment = fragment.replace(
        '#include <lights_fragment_begin>',
        `
            ${lights_fragment_beginToon}
            `,
      );

      shader.fragmentShader = fragment;
    };
    originMaterial.needsUpdate = true;
    return originMaterial;
  }
  public getToonMaterial_Door(originMaterial: MeshPhysicalMaterial) {
    originMaterial.metalness = 0.15;
    originMaterial.color = new Color('#454545');
    originMaterial.onBeforeCompile = function (shader) {
      let fragment = shader.fragmentShader;
      fragment = fragment.replace(
        '#include <lights_physical_pars_fragment>',
        `
            #include <lights_physical_pars_fragment>
            vec3 fresnelCol = vec3(254., 103., 57.)/255.;
            ${RE_Direct_ToonPhysical_Road}
            `,
      );
      fragment = fragment.replace(
        '#include <lights_fragment_begin>',
        `
            ${lights_fragment_beginToon}
            `,
      );

      shader.fragmentShader = fragment;
    };
    originMaterial.needsUpdate = true;
    return originMaterial;
  }
}
export const toonMaterials = new ToonMaterials();

export class MTTest extends Plugin {
  get Cloud_Color_1() {
    return M_Cloud.uniforms.color_1.value;
  }

  set Cloud_Color_1(v: Color) {
    M_Cloud.uniforms.color_1.value.copy(v);
  }
  get intensity_Color_1() {
    return M_Cloud.uniforms.color_intensity_1.value;
  }

  set intensity_Color_1(v: number) {
    M_Cloud.uniforms.color_intensity_1.value = v;
  }
  get Cloud_Color_2() {
    return M_Cloud.uniforms.color_2.value;
  }

  set Cloud_Color_2(v: Color) {
    M_Cloud.uniforms.color_2.value.copy(v);
  }
  get intensity_Color_2() {
    return M_Cloud.uniforms.color_intensity_2.value;
  }

  set intensity_Color_2(v: number) {
    M_Cloud.uniforms.color_intensity_2.value = v;
  }
  update(): void {}
}
