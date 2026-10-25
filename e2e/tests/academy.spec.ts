    expect(academyContext?.scopeId).toBeTruthy();
    const switched = await lecturerApi.post(`${BASE_URL}/api/iam/switch-context`, {
      headers: auth(baseToken),
      data: { scopeType: academyContext.scopeType, scopeId: academyContext.scopeId, branchId: academyContext.branchId },
    });
    expect(switched.status()).toBe(200);
    const switchedBody = await switched.json();
    const token = switchedBody.data?.accessToken || switchedBody.accessToken;
    expect(token).toBeTruthy();
    const otherAcademyId = `academy-cross-tenant-${Date.now()}`;