import '@kitware/vtk.js/favicon';
/* eslint-disable import/prefer-default-export */
/* eslint-disable import/no-extraneous-dependencies */

// Load the rendering pieces we want to use (for both WebGL and WebGPU)
import '@kitware/vtk.js/Rendering/Profiles/Geometry';

import { strFromU8, unzipSync } from 'fflate';

import macro from '@kitware/vtk.js/macros';

import HttpDataAccessHelper from '@kitware/vtk.js/IO/Core/DataAccessHelper/HttpDataAccessHelper';
import vtkFullScreenRenderWindow from '@kitware/vtk.js/Rendering/Misc/FullScreenRenderWindow';
import vtkURLExtract from '@kitware/vtk.js/Common/Core/URLExtract';
import { fromArrayBuffer } from '@kitware/vtk.js/Common/Core/Base64';

import vtkOBJReader from '@kitware/vtk.js/IO/Misc/OBJReader';
import vtkMTLReader from '@kitware/vtk.js/IO/Misc/MTLReader';
import vtkMapper from '@kitware/vtk.js/Rendering/Core/Mapper';
import vtkActor from '@kitware/vtk.js/Rendering/Core/Actor';

// Force DataAccessHelper to have access to various data source
import '@kitware/vtk.js/IO/Core/DataAccessHelper/HtmlDataAccessHelper';
import '@kitware/vtk.js/IO/Core/DataAccessHelper/JSZipDataAccessHelper';

import style from './OBJViewer.module.css';

const iOS = /iPad|iPhone|iPod/.test(window.navigator.platform);
let autoInit = true;

// Look at URL an see if we should load a file
// ?fileURL=https://data.kitware.com/api/v1/item/59cdbb588d777f31ac63de08/download
// &noInterpolation

const userParams = vtkURLExtract.extractURLParameters();

// Add class to body if iOS device --------------------------------------------

if (iOS) {
  document.querySelector('body').classList.add('is-ios-device');
}

function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

function emptyContainer(container) {
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }
}

function unpack(zipContent) {
  if (zipContent instanceof Blob) {
    return zipContent.arrayBuffer().then((ab) => new Uint8Array(ab));
  }
  if (zipContent instanceof ArrayBuffer) {
    return Promise.resolve(new Uint8Array(zipContent));
  }
  return Promise.reject(new Error('invalid zip content'));
}

function loadZipContent(zipContent, renderWindow, renderer) {
  const fileContents = { obj: {}, mtl: {}, img: {} };
  unpack(zipContent).then((zipArrayBuffer) => {
    const decompressedFiles = unzipSync(new Uint8Array(zipArrayBuffer));

    function done() {
      // Attach images to MTLs
      const promises = [];
      Object.keys(fileContents.mtl).forEach((mtlFilePath) => {
        const mtlReader = fileContents.mtl[mtlFilePath];
        const basePath = mtlFilePath
          .split('/')
          .filter((v, i, a) => i < a.length - 1)
          .join('/');
        mtlReader.listImages().forEach((relPath) => {
          const key = basePath.length ? `${basePath}/${relPath}` : relPath;
          const imgSRC = fileContents.img[key];
          if (imgSRC) {
            promises.push(mtlReader.setImageSrc(relPath, imgSRC));
            console.log('register promise');
          }
        });
      });

      Promise.all(promises).then(() => {
        console.log('load obj...');
        // Create pipeline from obj
        Object.keys(fileContents.obj).forEach((objFilePath) => {
          const mtlFilePath = objFilePath.replace(/\.obj$/, '.mtl');
          const objReader = fileContents.obj[objFilePath];
          const mtlReader = fileContents.mtl[mtlFilePath];

          const size = objReader.getNumberOfOutputPorts();
          for (let i = 0; i < size; i++) {
            const source = objReader.getOutputData(i);
            const mapper = vtkMapper.newInstance();
            const actor = vtkActor.newInstance();
            const name = source.get('name').name;

            actor.setMapper(mapper);
            mapper.setInputData(source);
            renderer.addActor(actor);

            if (mtlReader && name) {
              mtlReader.applyMaterialToActor(name, actor);
            }
          }
        });
        renderer.resetCamera();
        renderWindow.render();
      });
    }

    Object.entries(decompressedFiles).forEach(([relativePath, fileData]) => {
      if (relativePath.match(/\.obj$/i)) {
        const txt = strFromU8(fileData);
        const reader = vtkOBJReader.newInstance({ splitMode: 'usemtl' });
        reader.parseAsText(txt);
        fileContents.obj[relativePath] = reader;
      }
      if (relativePath.match(/\.mtl$/i)) {
        const txt = strFromU8(fileData);
        const reader = vtkMTLReader.newInstance({
          interpolateTextures: !userParams.noInterpolation,
        });
        reader.parseAsText(txt);
        fileContents.mtl[relativePath] = reader;
      }
      if (relativePath.match(/\.jpg$/i) || relativePath.match(/\.png$/i)) {
        const txt = fromArrayBuffer(fileData);
        const ext = relativePath.slice(-3).toLowerCase();
        fileContents.img[relativePath] = `data:image/${ext};base64,${txt}`;
      }
    });

    done();
  });
}

export function load(container, options) {
  autoInit = false;
  emptyContainer(container);

  const fullScreenRenderer = vtkFullScreenRenderWindow.newInstance({
    background: [0, 0, 0],
    rootContainer: container,
    containerStyle: { height: '100%', width: '100%', position: 'absolute' },
  });
  const renderer = fullScreenRenderer.getRenderer();
  const renderWindow = fullScreenRenderer.getRenderWindow();

  if (options.file) {
    if (options.ext === 'obj') {
      const reader = new FileReader();
      reader.onload = function onLoad(e) {
        const objReader = vtkOBJReader.newInstance();
        objReader.parseAsText(reader.result);
        const nbOutputs = objReader.getNumberOfOutputPorts();
        for (let idx = 0; idx < nbOutputs; idx++) {
          const source = objReader.getOutputData(idx);
          const mapper = vtkMapper.newInstance();
          const actor = vtkActor.newInstance();
          actor.setMapper(mapper);
          mapper.setInputData(source);
          renderer.addActor(actor);
        }
        renderer.resetCamera();
        renderWindow.render();
      };
      reader.readAsText(options.file);
    } else {
      loadZipContent(options.file, renderWindow, renderer);
    }
  } else if (options.fileURL) {
    const progressContainer = document.createElement('div');
    progressContainer.setAttribute('class', style.progress);
    container.appendChild(progressContainer);

    const progressCallback = (progressEvent) => {
      if (progressEvent.lengthComputable) {
        const percent = Math.floor(
          (100 * progressEvent.loaded) / progressEvent.total
        );
        progressContainer.innerHTML = `Loading ${percent}%`;
      } else {
        progressContainer.innerHTML = macro.formatBytesToProperUnit(
          progressEvent.loaded
        );
      }
    };

    HttpDataAccessHelper.fetchBinary(options.fileURL, {
      progressCallback,
    }).then((content) => {
      container.removeChild(progressContainer);
      loadZipContent(content, renderWindow, renderer);
    });
  }
}

export function initLocalFileLoader(container) {
  const exampleContainer = document.querySelector('.content');
  const rootBody = document.querySelector('body');
  const myContainer = container || exampleContainer || rootBody;

  if (myContainer !== container) {
    myContainer.classList.add(style.fullScreen);
    rootBody.style.margin = '0';
    rootBody.style.padding = '0';
  } else {
    rootBody.style.margin = '0';
    rootBody.style.padding = '0';
  }

  const fileContainer = document.createElement('div');
  fileContainer.innerHTML = `<div class="${style.bigFileDrop}"/><input type="file" accept=".zip,.obj" style="display: none;"/>`;
  myContainer.appendChild(fileContainer);

  const fileInput = fileContainer.querySelector('input');

  function handleFile(e) {
    preventDefaults(e);
    const dataTransfer = e.dataTransfer;
    const files = e.target.files || dataTransfer.files;
    if (files.length === 1) {
      myContainer.removeChild(fileContainer);
      const ext = files[0].name.split('.').slice(-1)[0];
      load(myContainer, { file: files[0], ext });
    }
  }

  fileInput.addEventListener('change', handleFile);
  fileContainer.addEventListener('drop', handleFile);
  fileContainer.addEventListener('click', (e) => fileInput.click());
  fileContainer.addEventListener('dragover', preventDefaults);
}

if (userParams.url || userParams.fileURL) {
  const exampleContainer = document.querySelector('.content');
  const rootBody = document.querySelector('body');
  const myContainer = exampleContainer || rootBody;
  if (myContainer) {
    myContainer.classList.add(style.fullScreen);
    rootBody.style.margin = '0';
    rootBody.style.padding = '0';
  }
  load(myContainer, userParams);
}

// Auto setup if no method get called within 100ms
setTimeout(() => {
  if (autoInit) {
    initLocalFileLoader();
  }
}, 100);
