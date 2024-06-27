import { type Mat } from '@techstark/opencv-js'

const threshold = 170
const minCoutoursScale = 20

async function fileToImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => {
      const image = new Image()
      image.src = reader.result as string
      image.onload = () => resolve(image)
      image.onerror = reject
    }
    reader.onerror = reject
  })
}

async function matToBlob(mat: Mat) {
  const { cv } = window

  return new Promise<Blob>((resolve, reject) => {
    const canvas = document.createElement('canvas')
    cv.imshow(canvas, mat)
    canvas.toBlob((blob) => {
      if (!blob) return reject(`toBlob failed`)
      resolve(blob)
    })
  })
}

function getContourPoints(mat: Mat) {
  const { cv } = window

  const grayscaleMat = new cv.Mat()
  cv.cvtColor(mat, grayscaleMat, cv.COLOR_RGBA2GRAY)

  const thresholdMat = new cv.Mat()
  cv.threshold(grayscaleMat, thresholdMat, threshold, 255, cv.THRESH_BINARY)

  const contours = new cv.MatVector()
  const hierarchy = new cv.Mat()
  cv.findContours(thresholdMat, contours, hierarchy, cv.RETR_CCOMP, cv.CHAIN_APPROX_SIMPLE)
  hierarchy.delete()

  let points: Mat|null = null
  let maxContourArea = 0

  for (let i = 0; i < contours.size(); ++i) {
    const contour = contours.get(i)
    const contourArea = cv.contourArea(contour)
    const maxRectScale = contourArea / (mat.cols * mat.rows) * 100
    if (maxRectScale >= minCoutoursScale && contourArea > maxContourArea) {
      const approxMat = new cv.Mat()
      const epsilon = 0.02 * cv.arcLength(contour, true)
      cv.approxPolyDP(contour, approxMat, epsilon, true)

      if (approxMat.size().height === 4) {
        maxContourArea = contourArea
        points = approxMat
      }
    }
  }

  contours.delete()
  grayscaleMat.delete()
  thresholdMat.delete()

  if (points) {
    points.convertTo(points, cv.CV_32FC2)
  }

  return points
}

export async function transform(file: File) {
  const { cv } = window
  const image = await fileToImage(file)
  const mat = cv.imread(image)

  const from = getContourPoints(mat)
  if (!from) {
    mat.delete()
    return file
  }

  const transformedMat = new cv.Mat()
  const { rows, cols } = mat
  const to = cv.matFromArray(4, 1, cv.CV_32FC2, [
    cols, 0, 0, 0, 0, rows, cols, rows,
  ])
  const m = cv.getPerspectiveTransform(from, to)
  cv.warpPerspective(mat, transformedMat, m, new cv.Size(cols, rows))

  from.delete()
  to.delete()
  mat.delete()

  return await matToBlob(transformedMat)
}

export const OpenCV = {
  transform,
}
