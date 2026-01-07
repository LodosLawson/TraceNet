/// <reference types="vite/client" />
import { Object3DNode } from '@react-three/fiber';
import { ShaderMaterial } from 'three';

declare global {
    namespace JSX {
        interface IntrinsicElements {
            atmosphereMaterial: Object3DNode<ShaderMaterial, typeof ShaderMaterial>;
        }
    }
}
