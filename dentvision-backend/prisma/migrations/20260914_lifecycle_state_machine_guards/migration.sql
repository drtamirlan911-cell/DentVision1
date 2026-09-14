-- DentVision lifecycle integrity guard.
-- Backend routes may evolve, but the database must never accept an impossible
-- referral/lab-order transition. This is intentionally implemented at the
-- persistence boundary so every writer is covered.

CREATE OR REPLACE FUNCTION dentvision_guard_referral_status_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  IF NOT (
    (OLD.status::text = 'DRAFT' AND NEW.status::text IN ('SENT', 'CANCELLED')) OR
    (OLD.status::text = 'SENT' AND NEW.status::text IN ('ACCEPTED', 'CANCELLED')) OR
    (OLD.status::text = 'ACCEPTED' AND NEW.status::text IN ('SCHEDULED', 'IN_PROGRESS', 'CANCELLED')) OR
    (OLD.status::text = 'SCHEDULED' AND NEW.status::text IN ('PATIENT_ARRIVED', 'IN_PROGRESS', 'CANCELLED')) OR
    (OLD.status::text = 'PATIENT_ARRIVED' AND NEW.status::text IN ('IN_PROGRESS', 'CANCELLED')) OR
    (OLD.status::text = 'IN_PROGRESS' AND NEW.status::text IN ('COMPLETED', 'CANCELLED'))
  ) THEN
    RAISE EXCEPTION 'Invalid referral status transition: % -> %', OLD.status, NEW.status
      USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dentvision_referral_status_transition ON "referrals";
CREATE TRIGGER trg_dentvision_referral_status_transition
BEFORE UPDATE OF status ON "referrals"
FOR EACH ROW
EXECUTE FUNCTION dentvision_guard_referral_status_transition();

CREATE OR REPLACE FUNCTION dentvision_guard_lab_order_status_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  IF NOT (
    (OLD.status::text = 'pending' AND NEW.status::text IN ('sent', 'cancelled')) OR
    (OLD.status::text = 'sent' AND NEW.status::text IN ('in_progress', 'delayed', 'cancelled')) OR
    (OLD.status::text = 'in_progress' AND NEW.status::text IN ('try_in', 'ready', 'remake', 'delayed', 'cancelled')) OR
    (OLD.status::text = 'try_in' AND NEW.status::text IN ('adjustment', 'ready', 'remake', 'delayed', 'cancelled')) OR
    (OLD.status::text = 'adjustment' AND NEW.status::text IN ('ready', 'remake', 'delayed', 'cancelled')) OR
    (OLD.status::text = 'ready' AND NEW.status::text IN ('delivered', 'remake', 'delayed', 'cancelled')) OR
    (OLD.status::text = 'remake' AND NEW.status::text IN ('in_progress', 'cancelled')) OR
    (OLD.status::text = 'delayed' AND NEW.status::text IN ('in_progress', 'cancelled'))
  ) THEN
    RAISE EXCEPTION 'Invalid lab order status transition: % -> %', OLD.status, NEW.status
      USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dentvision_lab_order_status_transition ON "lab_orders";
CREATE TRIGGER trg_dentvision_lab_order_status_transition
BEFORE UPDATE OF status ON "lab_orders"
FOR EACH ROW
EXECUTE FUNCTION dentvision_guard_lab_order_status_transition();
