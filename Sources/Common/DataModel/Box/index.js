import _defineProperty from '@babel/runtime/helpers/defineProperty';
import _toConsumableArray from '@babel/runtime/helpers/toConsumableArray';
import macro from '../../macros.js';
import vtkBoundingBox from './BoundingBox.js';

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
// Global methods
// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------
// Static API
// ----------------------------------------------------------------------------

function IntersectWithLine(bounds, p1, p2, t1, t2, x1, x2, plane, plane2) {
  plane1 = -1;
  plane2 = -1;
  t1 = 0.0;
  t2 = 1.0;

  for (let j = 0; j < 3; j++)
  {
    for (let k = 0; k < 2; k++)
    {
      // Compute distances of p1 and p2 from the plane along the plane normal
      let i = 2 * j + k;
      let d1 = (bounds[i] - p1[j]) * (1 - 2 * k);
      let d2 = (bounds[i] - p2[j]) * (1 - 2 * k);

      // If both distances are positive, both points are outside
      if (d1 > 0 && d2 > 0)
      {
        return 0;
      }
      // If one of the distances is positive, the line crosses the plane
      else if (d1 > 0 || d2 > 0)
      {
        // Compute fractional distance "t" of the crossing between p1 & p2
        let t = 0.0;
        if (d1 != 0)
        {
          t = d1 / (d1 - d2);
        }

        // If point p1 was clipped, adjust t1
        if (d1 > 0)
        {
          if (t >= t1)
          {
            t1 = t;
            plane1 = i;
          }
        }
        // else point p2 was clipped, so adjust t2
        else
        {
          if (t <= t2)
          {
            t2 = t;
            plane2 = i;
          }
        }

        // If this happens, there's no line left
        if (t1 > t2)
        {
          // Allow for planes that are coincident or slightly inverted
          if (plane1 < 0 || plane2 < 0 || (plane1 >> 1) != (plane2 >> 1))
          {
            return 0;
          }
        }
      }
    }
  }

  let x = x1;
  let t = t1;
  plane = plane1;

  for (let count = 0; count < 2; count++)
  {
    if (x)
    {
      for (let i = 0; i < 3; i++)
      {
        if (plane == 2 * i || plane == 2 * i + 1)
        {
          x[i] = bounds[plane];
        }
        else
        {
          x[i] = p1[i] * (1.0 - t) + p2[i] * t;
          if (x[i] < bounds[2 * i])
          {
            x[i] = bounds[2 * i];
          }
          if (x[i] > bounds[2 * i + 1])
          {
            x[i] = bounds[2 * i + 1];
          }
        }
      }
    }

    x = x2;
    t = t2;
    plane = plane2;
  }

  return 1;
}

var STATIC = {
  IntersectWithLine: IntersectWithLine,
}; // ----------------------------------------------------------------------------
// vtkBox methods
// ----------------------------------------------------------------------------

function vtkBox(publicAPI, model) {
  // Set our className
  model.classHierarchy.push('vtkBox'); // TODO: replace with macro.setArray ?

  publicAPI.setBounds = function () {
    var boundsArray = [];

    for (var _len = arguments.length, bounds = new Array(_len), _key = 0; _key < _len; _key++) {
      bounds[_key] = arguments[_key];
    }

    if (Array.isArray(bounds[0])) {
      boundsArray = bounds[0];
    } else {
      for (var i = 0; i < bounds.length; i++) {
        boundsArray.push(bounds[i]);
      }
    }

    if (boundsArray.length !== 6) {
      console.log('vtkBox.setBounds', boundsArray, bounds);
      return;
    }

    vtkBoundingBox.setBounds(model.bbox, boundsArray);
  };

  publicAPI.getBounds = function () {
    return model.bbox;
  };

  publicAPI.evaluateFunction = function (x, y, z) {
    var point = Array.isArray(x) ? x : [x, y, z];
    var diff;
    var dist;
    var t;
    var minDistance = -Number.MAX_VALUE;
    var distance = 0;
    var minPoint = vtkBoundingBox.getMinPoint(model.bbox);
    var maxPoint = vtkBoundingBox.getMaxPoint(model.bbox);
    var inside = 1;

    for (var i = 0; i < 3; i++) {
      diff = vtkBoundingBox.getLength(model.bbox, i);

      if (diff !== 0.0) {
        t = (point[i] - minPoint[i]) / diff;

        if (t < 0.0) {
          inside = 0;
          dist = minPoint[i] - point[i];
        } else if (t > 1.0) {
          inside = 0;
          dist = point[i] - maxPoint[i];
        } else {
          // want negative distance, we are inside
          if (t <= 0.5) {
            dist = minPoint[i] - point[i];
          } else {
            dist = point[i] - maxPoint[i];
          }

          if (dist > minDistance) {
            // remember, it's engative
            minDistance = dist;
          }
        } // end if inside

      } else {
        dist = Math.abs(point[i] - minPoint[i]);

        if (dist > 0.0) {
          inside = 0;
        }
      }

      if (dist > 0.0) {
        distance += dist * dist;
      }
    } // end for i


    distance = Math.sqrt(distance);

    if (inside) {
      return minDistance;
    }

    return distance;
  };

  publicAPI.addBounds = function () {
    var boundsArray = [];

    if (Array.isArray(arguments.length <= 0 ? undefined : arguments[0])) {
      boundsArray = arguments.length <= 0 ? undefined : arguments[0];
    } else {
      for (var i = 0; i < arguments.length; i++) {
        boundsArray.push(i < 0 || arguments.length <= i ? undefined : arguments[i]);
      }
    }

    if (boundsArray.length !== 6) {
      return;
    }

    vtkBoundingBox.addBounds.apply(vtkBoundingBox, [model.bbox].concat(_toConsumableArray(boundsArray)));
    publicAPI.modified();
  };

  publicAPI.addBox = function (other) {
    return publicAPI.addBounds(other.getBounds());
  };

  publicAPI.IntersectWithLine = IntersectWithLine 

} // ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------


var DEFAULT_VALUES = {
  bbox: _toConsumableArray(vtkBoundingBox.INIT_BOUNDS)
}; // ----------------------------------------------------------------------------

function extend(publicAPI, model) {
  var initialValues = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  Object.assign(model, DEFAULT_VALUES, initialValues); // Object methods

  macro.obj(publicAPI, model);
  vtkBox(publicAPI, model);
} // ----------------------------------------------------------------------------

var newInstance = macro.newInstance(extend, 'vtkBox'); // ----------------------------------------------------------------------------

var vtkBox$1 = _objectSpread({
  newInstance: newInstance,
  extend: extend
}, STATIC);

export { STATIC, vtkBox$1 as default, extend, newInstance };
