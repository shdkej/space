import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({base:'/sort/',plugins:[react()],build:{outDir:'../dist/sort',emptyOutDir:true},server:{proxy:{'/api':{target:'https://images.aws.shdkej.com',changeOrigin:true,headers:{origin:'https://images.aws.shdkej.com'}}}}});
