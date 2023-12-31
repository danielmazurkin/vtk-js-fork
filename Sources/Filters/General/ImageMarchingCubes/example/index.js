import '@kitware/vtk.js/favicon';

// Load the rendering pieces we want to use (for both WebGL and WebGPU)
import '@kitware/vtk.js/Rendering/Profiles/Geometry';

import vtkActor from '@kitware/vtk.js/Rendering/Core/Actor';
import vtkFullScreenRenderWindow from '@kitware/vtk.js/Rendering/Misc/FullScreenRenderWindow';
import vtkImageMarchingCubes from '@kitware/vtk.js/Filters/General/ImageMarchingCubes';
import vtkMapper from '@kitware/vtk.js/Rendering/Core/Mapper';
import vtkSampleFunction from '@kitware/vtk.js/Imaging/Hybrid/SampleFunction';
import vtkSphere from '@kitware/vtk.js/Common/DataModel/Sphere';

import controlPanel from './controller.html';

// ----------------------------------------------------------------------------
// Standard rendering code setup
// ----------------------------------------------------------------------------

const fullScreenRenderer = vtkFullScreenRenderWindow.newInstance();
const renderer = fullScreenRenderer.getRenderer();
const renderWindow = fullScreenRenderer.getRenderWindow();

// ----------------------------------------------------------------------------
// Example code
// ----------------------------------------------------------------------------
const actor = vtkActor.newInstance();
renderer.addActor(actor);

const mapper = vtkMapper.newInstance();
actor.setMapper(mapper);

// Build pipeline
const sphere = vtkSphere.newInstance({ center: [0.0, 0.0, 0.0], radius: 0.5 });
const sample = vtkSampleFunction.newInstance({
  implicitFunction: sphere,
  sampleDimensions: [50, 50, 50],
  modelBounds: [-0.5, 0.5, -0.5, 0.5, -0.5, 0.5],
});
const mCubes = vtkImageMarchingCubes.newInstance({ contourValue: 0.0 });

// Connect the pipeline proper
mCubes.setInputConnection(sample.getOutputPort());
mapper.setInputConnection(mCubes.getOutputPort());

// ----------------------------------------------------------------------------
// UI control handling
// ----------------------------------------------------------------------------
fullScreenRenderer.addController(controlPanel);

// Define the isosurface value
document.querySelector('.isoValue').addEventListener('input', (e) => {
  const value = Number(e.target.value);
  mCubes.setContourValue(value);
  renderWindow.render();
});

// Define the volume resolution
document.querySelector('.volumeResolution').addEventListener('input', (e) => {
  const value = Number(e.target.value);
  sample.setSampleDimensions(value, value, value);
  renderWindow.render();
});

// Define the sphere radius
document.querySelector('.sphereRadius').addEventListener('input', (e) => {
  const value = Number(e.target.value);
  sphere.setRadius(value);
  renderWindow.render();
});

// Indicate whether to compute normals or not
document.querySelector('.computeNormals').addEventListener('change', (e) => {
  mCubes.setComputeNormals(!!e.target.checked);
  renderWindow.render();
});

// Indicate whether to merge conincident points or not
document.querySelector('.mergePoints').addEventListener('change', (e) => {
  mCubes.setMergePoints(!!e.target.checked);
  renderWindow.render();
});

// -----------------------------------------------------------

renderer.resetCamera();
renderWindow.render();

// -----------------------------------------------------------
// Make some variables global so that you can inspect and
// modify objects in your browser's developer console:
// -----------------------------------------------------------

global.source = sample;
global.filter = mCubes;
global.mapper = mapper;
global.actor = actor;
