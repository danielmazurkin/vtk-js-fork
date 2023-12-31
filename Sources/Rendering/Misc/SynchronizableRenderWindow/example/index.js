import '@kitware/vtk.js/favicon';

// Load the rendering pieces we want to use (for both WebGL and WebGPU)
import '@kitware/vtk.js/Rendering/Profiles/All';

import { strFromU8, unzipSync } from 'fflate';

import vtkInteractorStyleTrackballCamera from '@kitware/vtk.js/Interaction/Style/InteractorStyleTrackballCamera';
import vtkOpenGLRenderWindow from '@kitware/vtk.js/Rendering/OpenGL/RenderWindow';
import vtkRenderWindowInteractor from '@kitware/vtk.js/Rendering/Core/RenderWindowInteractor';
import vtkSynchronizableRenderWindow from '@kitware/vtk.js/Rendering/Misc/SynchronizableRenderWindow';

import style from './SynchronizableRenderWindow.module.css';

const CONTEXT_NAME = '__zipFileContent__';

// ----------------------------------------------------------------------------

function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

// ----------------------------------------------------------------------------

function emptyContainer(container) {
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }
}

// ----------------------------------------------------------------------------

function unpack(zipContent) {
  if (zipContent instanceof Blob) {
    return zipContent.arrayBuffer().then((ab) => new Uint8Array(ab));
  }
  if (zipContent instanceof ArrayBuffer) {
    return Promise.resolve(new Uint8Array(zipContent));
  }
  return Promise.reject(new Error('invalid zip content'));
}

// ----------------------------------------------------------------------------

function loadZipContent(zipContent, container) {
  const fileContents = { state: null, arrays: {} };

  function getArray(hash, binary) {
    return Promise.resolve(fileContents.arrays[hash]);
  }

  unpack(zipContent).then((zipArrayBuffer) => {
    const decompressedFiles = unzipSync(zipArrayBuffer);

    function done() {
      // Synchronize context
      const synchronizerContext =
        vtkSynchronizableRenderWindow.getSynchronizerContext(CONTEXT_NAME);
      synchronizerContext.setFetchArrayFunction(getArray);

      // openGLRenderWindow
      const openGLRenderWindow = vtkOpenGLRenderWindow.newInstance();
      openGLRenderWindow.setContainer(container);

      // RenderWindow (synchronizable)
      const renderWindow = vtkSynchronizableRenderWindow.newInstance({
        synchronizerContext,
      });
      renderWindow.addView(openGLRenderWindow);

      // Size handling
      function resize() {
        const dims = container.getBoundingClientRect();
        const devicePixelRatio = window.devicePixelRatio || 1;
        openGLRenderWindow.setSize(
          Math.floor(dims.width * devicePixelRatio),
          Math.floor(dims.height * devicePixelRatio)
        );
        renderWindow.render();
      }
      window.addEventListener('resize', resize);
      resize();

      // Interactor
      const interactor = vtkRenderWindowInteractor.newInstance();
      interactor.setInteractorStyle(
        vtkInteractorStyleTrackballCamera.newInstance()
      );
      interactor.setView(openGLRenderWindow);
      interactor.initialize();
      interactor.bindEvents(container);

      // Load the scene
      renderWindow.getSynchronizerContext().onProgressEvent((count) => {
        console.log('progress', count);
      });
      renderWindow.synchronize(fileContents.state).then((ok) => {
        if (ok) {
          console.log('Synchronization done');
        } else {
          console.log('Skip synchronization');
        }
      });
    }

    Object.entries(decompressedFiles).forEach(([relativePath, fileData]) => {
      const fileName = relativePath.split('/').pop();
      if (fileName === 'index.json') {
        fileContents.state = JSON.parse(strFromU8(fileData));
      }

      if (fileName.length === 32) {
        const hash = fileName;
        fileContents.arrays[hash] = fileData.buffer;
      }
    });

    done();
  });
}

// ----------------------------------------------------------------------------

export function load(container, options) {
  emptyContainer(container);
  loadZipContent(options.file, container);
}

// ----------------------------------------------------------------------------

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
  fileContainer.innerHTML = `<div class="${style.bigFileDrop}"/>
    <input type="file" accept=".zip,.obj" style="display: none;"/>`;
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

// ----------------------------------------------------------------------------
// Auto setup
// ----------------------------------------------------------------------------

initLocalFileLoader();
