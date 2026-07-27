// Unit tests — Camera subsystem (math + smoothing controller).
#include "Engine/Camera/Camera.hpp"
#include "Engine/Camera/CameraController.hpp"
#include "Framework/TestFramework.hpp"

using namespace inf::camera;
using namespace inf::math;

INF_TEST(Camera_ProducesFiniteMatrices)
{
    Camera cam;
    cam.SetPosition({0.0f, 10.0f, 20.0f});
    cam.SetTarget({0.0f, 0.0f, 0.0f});
    cam.SetLens(60.0f, 16.0f / 9.0f, 0.1f, 500.0f);

    const Mat4 view = cam.ViewMatrix();
    const Mat4 proj = cam.ProjectionMatrix();
    // Projection must map depth: m[2][3] is -1 for right-handed perspective.
    REQUIRE_EQ(proj.m[2][3], -1.0f);
    // View matrix bottom-right stays 1 (affine).
    REQUIRE_EQ(view.m[3][3], 1.0f);
}

INF_TEST(Camera_ControllerConvergesToTarget)
{
    Camera cam;
    cam.SetPosition({0.0f, 0.0f, 0.0f});
    CameraController ctl(cam);
    ctl.SetDesiredPosition({10.0f, 0.0f, 0.0f});
    ctl.SetSmoothing(10.0f);

    // Step for a simulated second at 60 Hz; camera should approach the target.
    for (int i = 0; i < 60; ++i) { ctl.Update(1.0 / 60.0); }
    REQUIRE(cam.Position().x > 9.0f); // converged most of the way
}
